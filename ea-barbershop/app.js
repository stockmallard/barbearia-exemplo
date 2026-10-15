document.addEventListener('DOMContentLoaded', () => {
    // Configurações e Estado Global
    const state = {
        selectedService: null,
        selectedDate: '',
        selectedTime: '',
        clientName: ''
    };

    // DOM Elements
    const bookingDateInput = document.getElementById('booking-date');
    const clientNameInput = document.getElementById('client-name');
    const timeSlotsGrid = document.getElementById('time-slots-grid-list');
    const noDateMessage = document.getElementById('no-date-message');
    const bookingSummary = document.getElementById('booking-summary');
    const btnConfirm = document.getElementById('btn-confirm-booking');
    const btnHowToGet = document.getElementById('btn-how-to-get');
    const statusBadge = document.getElementById('status-badge');
    const statusText = document.getElementById('status-text');
    const toast = document.getElementById('toast-notification');

    // Elementos de Resumo
    const summaryService = document.getElementById('summary-service');
    const summaryDate = document.getElementById('summary-date');
    const summaryTime = document.getElementById('summary-time');
    const summaryName = document.getElementById('summary-name');
    const summaryValue = document.getElementById('summary-value');

    // --- INICIALIZAÇÃO ---
    
    // 1. Configurar data mínima como hoje (Local)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    bookingDateInput.setAttribute('min', todayStr);

    // 2. Destacar dia atual no cronograma e atualizar status "Aberto agora"
    updateShopStatus();
    setInterval(updateShopStatus, 60000); // Atualiza o status a cada minuto

    // --- EVENT LISTENERS ---

    // Escutar seleção de serviço
    const serviceItems = document.querySelectorAll('.service-item');
    serviceItems.forEach(item => {
        item.addEventListener('click', () => {
            serviceItems.forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');

            state.selectedService = {
                id: item.dataset.id,
                name: item.dataset.name,
                price: parseFloat(item.dataset.price),
                duration: item.dataset.duration
            };

            updateSummary();
        });
    });

    // Escutar mudança de data
    bookingDateInput.addEventListener('change', (e) => {
        const dateVal = e.target.value;
        if (!dateVal) {
            state.selectedDate = '';
            clearTimeSlots();
            updateSummary();
            return;
        }

        // Validar se é domingo
        const selectedDateObj = new Date(dateVal + 'T00:00:00');
        const dayOfWeek = selectedDateObj.getDay(); // 0 = Domingo, 1 = Segunda, etc.

        if (dayOfWeek === 0) {
            showToast('⚠️ A barbearia está fechada aos domingos. Por favor, escolha outro dia!');
            bookingDateInput.value = '';
            state.selectedDate = '';
            clearTimeSlots();
            updateSummary();
            return;
        }

        state.selectedDate = dateVal;
        state.selectedTime = ''; // Resetar horário ao mudar de data
        generateTimeSlots(dateVal, dayOfWeek);
        updateSummary();
    });

    // Escutar entrada de nome do cliente
    clientNameInput.addEventListener('input', (e) => {
        state.clientName = e.target.value.trim();
        updateSummary();
    });

    // Escutar clique no botão Como Chegar
    btnHowToGet.addEventListener('click', () => {
        const address = 'Rua Humberto Marques, 143 - Cangaiba, São Paulo - SP, 03725-070, Brasil';
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        window.open(url, '_blank');
    });

    // Escutar clique no botão Confirmar Agendamento
    btnConfirm.addEventListener('click', () => {
        if (!validateBooking()) return;

        // Salvar agendamento no localStorage para evitar duplicidade de horários
        saveBooking(state.selectedDate, state.selectedTime, state.selectedService, state.clientName);

        // Formatar mensagem do WhatsApp
        const dateFormatted = formatDate(state.selectedDate);
        const priceFormatted = state.selectedService.price.toFixed(2).replace('.', ',');

        const message = `Olá! Gostaria de confirmar meu agendamento na E.A BARBERSHOP.

✂️ AGENDAMENTO
━━━━━━━━━━━━━━
Cliente: ${state.clientName}
Serviço: ${state.selectedService.name}
Data: ${dateFormatted}
Horário: ${state.selectedTime}
Valor: R$ ${priceFormatted}
━━━━━━━━━━━━━━

Aguardo a confirmação. Obrigado!`;

        const whatsappUrl = `https://wa.me/557998248239?text=${encodeURIComponent(message)}`;
        
        // Exibir notificação de sucesso e redirecionar
        showToast('✅ Agendamento registrado! Redirecionando para o WhatsApp...');
        
        setTimeout(() => {
            window.open(whatsappUrl, '_blank');
            // Recarregar os horários para refletir a nova ocupação
            const selectedDateObj = new Date(state.selectedDate + 'T00:00:00');
            generateTimeSlots(state.selectedDate, selectedDateObj.getDay());
            resetForm();
        }, 1500);
    });

    // --- FUNÇÕES AUXILIARES ---

    // Mostra Toast personalizado
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3500);
    }

    // Limpa a grade de horários
    function clearTimeSlots() {
        timeSlotsGrid.style.display = 'none';
        noDateMessage.style.display = 'block';
        timeSlotsGrid.innerHTML = '';
    }

    // Gera os horários disponíveis com base na data e dia da semana
    function generateTimeSlots(dateStr, dayOfWeek) {
        timeSlotsGrid.innerHTML = '';
        noDateMessage.style.display = 'none';
        timeSlotsGrid.style.display = 'grid';

        // Definir horários iniciais e finais
        // Segunda a Sexta: 10:00 - 20:00
        // Sábado: 09:00 - 20:00
        let startHour = dayOfWeek === 6 ? 9 : 10;
        let endHour = 20;

        const slots = [];
        for (let hour = startHour; hour < endHour; hour++) {
            slots.push(`${String(hour).padStart(2, '0')}:00`);
            slots.push(`${String(hour).padStart(2, '0')}:30`);
        }

        // Ler agendamentos existentes do localStorage
        const allBookings = getBookings();

        // Obter data e hora atual para evitar horários passados se a data selecionada for hoje
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const currentDay = String(now.getDate()).padStart(2, '0');
        const todayStrLocal = `${currentYear}-${currentMonth}-${currentDay}`;
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        slots.forEach(time => {
            const slotButton = document.createElement('div');
            slotButton.className = 'time-slot';
            slotButton.textContent = time;

            // Verificar se o horário já está ocupado no localStorage para esta data
            const isBooked = allBookings.some(booking => booking.date === dateStr && booking.time === time);

            // Verificar se o horário é no passado (apenas se a data for hoje)
            let isPast = false;
            if (dateStr === todayStrLocal) {
                const [slotH, slotM] = time.split(':').map(Number);
                if (slotH < currentHour || (slotH === currentHour && slotM <= currentMinute)) {
                    isPast = true;
                }
            }

            if (isBooked || isPast) {
                slotButton.classList.add('disabled');
            } else {
                slotButton.addEventListener('click', () => {
                    const activeSelected = timeSlotsGrid.querySelector('.time-slot.selected');
                    if (activeSelected) {
                        activeSelected.classList.remove('selected');
                    }
                    slotButton.classList.add('selected');
                    state.selectedTime = time;
                    updateSummary();
                });
            }

            timeSlotsGrid.appendChild(slotButton);
        });
    }

    // Obtém lista de agendamentos no localStorage
    function getBookings() {
        const stored = localStorage.getItem('ea_barber_bookings');
        return stored ? JSON.parse(stored) : [];
    }

    // Salva agendamento no localStorage
    function saveBooking(date, time, service, client) {
        const bookings = getBookings();
        bookings.push({
            date,
            time,
            serviceName: service.name,
            clientName: client,
            value: service.price,
            createdAt: new Date().toISOString()
        });
        localStorage.setItem('ea_barber_bookings', JSON.stringify(bookings));
    }

    // Atualiza o Resumo na Tela
    function updateSummary() {
        const isServiceSelected = !!state.selectedService;
        const isDateSelected = !!state.selectedDate;
        const isTimeSelected = !!state.selectedTime;
        const isNameEntered = !!state.clientName;

        // Mostrar contêiner de resumo quando houver alguma interação básica
        if (isServiceSelected || isDateSelected || isTimeSelected || isNameEntered) {
            bookingSummary.style.display = 'block';
        } else {
            bookingSummary.style.display = 'none';
        }

        // Atualizar textos individuais
        summaryService.textContent = isServiceSelected ? state.selectedService.name : '-';
        summaryDate.textContent = isDateSelected ? formatDate(state.selectedDate) : '-';
        summaryTime.textContent = isTimeSelected ? state.selectedTime : '-';
        summaryName.textContent = isNameEntered ? state.clientName : '-';
        summaryValue.textContent = isServiceSelected 
            ? `R$ ${state.selectedService.price.toFixed(2).replace('.', ',')}` 
            : '-';

        // Validar e habilitar/desabilitar botão
        if (isServiceSelected && isDateSelected && isTimeSelected && isNameEntered) {
            btnConfirm.removeAttribute('disabled');
        } else {
            btnConfirm.setAttribute('disabled', 'true');
        }
    }

    // Valida todos os campos antes da finalização
    function validateBooking() {
        if (!state.selectedService) {
            showToast('⚠️ Por favor, escolha um serviço.');
            return false;
        }
        if (!state.selectedDate) {
            showToast('⚠️ Por favor, escolha uma data.');
            return false;
        }
        if (!state.selectedTime) {
            showToast('⚠️ Por favor, selecione um horário.');
            return false;
        }
        if (!state.clientName) {
            showToast('⚠️ Por favor, insira o seu nome.');
            return false;
        }

        // Verificação final no localStorage para evitar corridas locais
        const bookings = getBookings();
        const doubleBooking = bookings.some(b => b.date === state.selectedDate && b.time === state.selectedTime);
        if (doubleBooking) {
            showToast('❌ Este horário acabou de ser reservado. Por favor, escolha outro!');
            
            // Forçar re-geração dos horários
            const selectedDateObj = new Date(state.selectedDate + 'T00:00:00');
            generateTimeSlots(state.selectedDate, selectedDateObj.getDay());
            state.selectedTime = '';
            updateSummary();
            return false;
        }

        return true;
    }

    // Reseta o formulário após confirmação
    function resetForm() {
        state.selectedService = null;
        state.selectedDate = '';
        state.selectedTime = '';
        state.clientName = '';

        // Resetar inputs
        bookingDateInput.value = '';
        clientNameInput.value = '';

        // Resetar seleções visuais
        serviceItems.forEach(el => el.classList.remove('selected'));
        clearTimeSlots();
        updateSummary();
    }

    // Formata data do padrão YYYY-MM-DD para DD/MM/YYYY
    function formatDate(dateString) {
        const parts = dateString.split('-');
        if (parts.length !== 3) return dateString;
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    // Calcula se a barbearia está aberta ou fechada e destaca o dia atual
    function updateShopStatus() {
        const now = new Date();
        const day = now.getDay(); // 0 = Domingo, 1 = Segunda, etc.
        const hour = now.getHours();
        const minute = now.getMinutes();

        // 1. Remover destaque anterior de dias
        const hourItems = document.querySelectorAll('.hours-item');
        hourItems.forEach(item => item.classList.remove('highlight-today'));

        // 2. Mapear IDs de dias e destacar
        const dayIds = ['hours-dom', 'hours-seg', 'hours-ter', 'hours-qua', 'hours-qui', 'hours-sex', 'hours-sab'];
        const todayElement = document.getElementById(dayIds[day]);
        if (todayElement) {
            todayElement.classList.add('highlight-today');
        }

        // 3. Validar se a barbearia está aberta agora
        let isOpen = false;

        if (day >= 1 && day <= 5) {
            // Segunda a Sexta: 10:00 às 20:00
            if (hour >= 10 && hour < 20) {
                isOpen = true;
            }
        } else if (day === 6) {
            // Sábado: 09:00 às 20:00
            if (hour >= 9 && hour < 20) {
                isOpen = true;
            }
        }
        // Domingo: Fechado (isOpen continua false)

        // Atualizar visual do badge
        if (isOpen) {
            statusBadge.className = 'status-badge open';
            statusText.textContent = 'Aberta agora';
        } else {
            statusBadge.className = 'status-badge closed';
            statusText.textContent = 'Fechada';
        }
    }
});
