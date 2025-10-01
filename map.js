// Конфигурация
const config = {
    minZoom: 0.5,
    maxZoom: 5,
    labelMinZoom: 1.5
};

// Состояние приложения
let state = {
    selectedPlace: null,
    isDragging: false,
    debtData: null,
    zoom: null,
    lastZoomLevel: 1,
    isLoading: true // Добавляем флаг загрузки
};

// Словарь для нормализации буквенных суффиксов
const letterMap = {
    'a': 'а', 'б': 'б', 'с': 'с', 'e': 'е', 'd': 'д','c': 'с','b': 'б',
    'А': 'а', 'Б': 'б', 'С': 'с', 'Е': 'е', 'Д': 'д'
};

// Функция нормализации ID участка
function normalizePlaceId(placeId) {
    if (!placeId) return placeId;
    
    const match = placeId.match(/^(\d+)([a-zA-Zа-яА-Я]?)$/);
    if (!match) return placeId;
    
    const number = match[1];
    const letter = match[2];
    
    if (!letter) return number;
    
    const normalizedLetter = letterMap[letter] || letter.toLowerCase();
    return number + normalizedLetter;
}

// Функция для создания точной цветовой шкалы
function createColorScale(minBalance, maxBalance) {
    // Точные значения и цвета согласно спецификации
    const colorMap = [
        // Положительный баланс
        { value: 1000, color: '#07FE1E' },  // >1000р
        { value: 500, color: '#31F51D' },   // >500р
        { value: 0, color: '#57ED1D' },      // 0р
        
        // Отрицательный баланс
        { value: -50, color: '#7BE41C' },
        { value: -100, color: '#A0DC1B' },
        { value: -200, color: '#C4D41B' },
        { value: -300, color: '#E0CC19' },
        { value: -400, color: '#E5C716' },
        { value: -500, color: '#E8C113' },
        { value: -600, color: '#ECBC10' },
        { value: -700, color: '#F1B60C' },
        { value: -800, color: '#F6AF08' },
        { value: -900, color: '#FAAA05' },
        { value: -1000, color: '#FDA401' },
        { value: -1100, color: '#FF9400' },
        { value: -1500, color: '#FF7F00' },
        { value: -2000, color: '#FF6801' },
        { value: -3000, color: '#FF5001' },
        { value: -5000, color: '#FF3B00' },
        { value: -10000, color: '#FF2800' },
        { value: -15000, color: '#FF1101' },
        { value: -20000, color: '#FD0101' },
        { value: -25000, color: '#E30000' },
        { value: -30000, color: '#CF0101' },
        { value: -35000, color: '#B40000' },
        { value: -40000, color: '#9F0000' },
        { value: -45000, color: '#840101' },
        { value: -50000, color: '#6C0000' }  // -50000р и более
    ];
    
    // Сортируем по значению от большего к меньшему
    colorMap.sort((a, b) => b.value - a.value);
    
    const domain = colorMap.map(item => item.value);
    const range = colorMap.map(item => item.color);
    
    return d3.scaleLinear()
        .domain(domain)
        .range(range)
        .clamp(true);
}

// Улучшенная функция для получения цвета по долгу с точной схемой
function getDebtColor(balance, minBalance, maxBalance) {
    if (balance === null || balance === undefined) return '#BEC2CF';
    
    // Используем точную цветовую шкалу для всех значений
    const colorScale = createColorScale(minBalance, maxBalance);
    return colorScale(balance);
}

// Функция для вычисления центра участка
function getPlaceCenter(pathElement) {
    const bbox = pathElement.getBBox();
    return {
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2
    };
}

// Функция для очистки денежных значений
function cleanMoneyValue(value) {
    if (!value || value === '') return 0;
    
    // Убираем все символы кроме цифр, минуса, запятой и точки
    let cleanValue = value.toString()
        .replace(/[₽\s]/g, '')  // Убираем валюту и пробелы
        .replace(/,/g, '.');    // Заменяем запятую на точку
    
    // Если есть пробелы между цифрами (разделители тысяч), убираем их
    cleanValue = cleanValue.replace(/\s/g, '');
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
}

// Улучшенный парсинг CSV данных из Google Sheets
function parseCSVData(csvText) {
    const lines = csvText.split('\n');
    const firstLine = lines[0];
    const delimiter = ',';
    const headers = firstLine.split(delimiter);
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
            const values = parseCSVLine(lines[i], delimiter);
            
            if (values.length !== headers.length) {
                continue;
            }
            
            const row = {};
            
            headers.forEach((header, index) => {
                let value = values[index] || '';
                value = value.replace(/"/g, '').trim();
                header = header.trim()
                
                if (header === 'id') {
                    row[header] = parseInt(value) || 0;
                } else if (header === 'number') {
                    row[header] = value;
                } else if (header === 'size') {
                    row[header] = value.replace(/\s+/g, ' ').trim();
                } else if (header === 'cost_per_month') {
                    row[header] = cleanMoneyValue(value);
                } else if (header === 'cost_per_year') {
                    row[header] = cleanMoneyValue(value);
                } else if (header === 'start_balance') {
                    row[header] = cleanMoneyValue(value);
                } else if (header === 'balance') {
                    row[header] = cleanMoneyValue(value);
                } else if (header === 'paided') {
                    row[header] = cleanMoneyValue(value);
                } else if (header === 'need_to_paid') {
                    row[header] = cleanMoneyValue(value);
                } else if (header === 'months_of_debt') {
                    const cleanValue = value.replace(/[₽\s]/g, '').replace(',', '.');
                    row[header] = parseFloat(cleanValue) || 0;
                } else if (header === 'paided_last_month') {
                    row[header] = cleanMoneyValue(value);
                } else if (header === 'date') {
                    row[header] = value;
                } else {
                    row[header] = value;
                }
            });
            
            data.push(row);
        }
    }
    
    return data;
}

// Функция для парсинга CSV строки с учетом кавычек
function parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

// Инициализация
async function init() {
    showSpinner(); // Показываем спиннер перед загрузкой
    setupSearch(); // Инициализируем поиск
    await loadDebtData();
    await loadSVG();
    setupEventListeners();
    setupZoom();
    hideSpinner(); // Скрываем спиннер после загрузки
}

// Функции для спиннера
function showSpinner() {
    const spinner = document.createElement('div');
    spinner.id = 'loading-spinner';
    spinner.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(spinner);
}

function hideSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.remove();
    }
    state.isLoading = false;
}

// Функции для поиска
function setupSearch() {
    const searchContainer = document.createElement('div');
    searchContainer.id = 'search-container';
    searchContainer.innerHTML = `
        <input type="text" id="place-search" placeholder="Поиск участка...">
        <div id="search-suggestions" class="search-suggestions"></div>
    `;
    document.getElementById('map-container').appendChild(searchContainer);

    const searchInput = document.getElementById('place-search');
    const suggestionsContainer = document.getElementById('search-suggestions');
    let currentSuggestions = [];
    let selectedIndex = -1;
    
    // Обработчик ввода
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value.toLowerCase().trim();
        selectedIndex = -1;
        
        if (!value || !state.debtData) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        // Получаем все номера участков
        const allPlaces = Object.entries(state.debtData.debt_data).map(([id, data]) => ({
            id,
            number: data.number.toString()
        }));

        // Фильтруем участки по введенному значению
        currentSuggestions = allPlaces
            .filter(place => 
                place.id.toLowerCase().includes(value) || 
                place.number.toLowerCase().includes(value)
            )
            .sort((a, b) => {
                // Сортируем по числовой части, затем по буквенной
                const numA = a.number.match(/^\d+/)?.[0] || "0";
                const numB = b.number.match(/^\d+/)?.[0] || "0";
                return numA - numB || a.number.localeCompare(b.number);
            })
            .slice(0, 15)
            .map(place => place.id);

        // Отображаем подсказки
        if (currentSuggestions.length > 0) {
            suggestionsContainer.innerHTML = currentSuggestions
                .map(placeId => {
                    const placeData = state.debtData.debt_data[placeId];
                    return `<div class="suggestion-item" data-place="${placeId}">${placeData.number}</div>`;
                })
                .join('');
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.innerHTML = '<div class="suggestion-item no-results">Участки не найдены</div>';
            suggestionsContainer.style.display = 'block';
        }
    });

    // Обработчик клавиатуры
    searchInput.addEventListener('keydown', (e) => {
        if (suggestionsContainer.style.display === 'none') return;

        const items = suggestionsContainer.querySelectorAll('.suggestion-item');
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelection();
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelection();
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0) {
                    selectPlaceFromSearch(currentSuggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                suggestionsContainer.style.display = 'none';
                selectedIndex = -1;
                break;
        }
    });

    function updateSelection() {
        const items = suggestionsContainer.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === selectedIndex);
        });
    }

    function selectPlaceFromSearch(placeId) {
        const placeData = state.debtData.debt_data[placeId];
        searchInput.value = placeData.number;
        suggestionsContainer.style.display = 'none';
        selectedIndex = -1;

        // Находим и выбираем участок
        const place = document.querySelector(`path[data-place="${placeId}"]`);
        if (place) {
            selectPlace(placeId);
            
            // Центрируем карту на выбранном участке
            const bbox = place.getBBox();
            const svg = d3.select('#map-svg');
            const targetScale = Math.max(config.minZoom * 2, d3.zoomTransform(svg.node()).k);
            
            const centerX = bbox.x + bbox.width / 2;
            const centerY = bbox.y + bbox.height / 2;
            
            svg.transition()
                .duration(750)
                .call(state.zoom.transform, 
                    d3.zoomIdentity
                        .translate(window.innerWidth / 2 - centerX * targetScale, 
                                 window.innerHeight / 2 - centerY * targetScale)
                        .scale(targetScale)
                );

            // Показываем тултип
            showTooltip({ target: place }, placeId);
        }
    }

    // Обработчик клика по подсказке
    suggestionsContainer.addEventListener('click', (e) => {
        const suggestionItem = e.target.closest('.suggestion-item');
        if (!suggestionItem || suggestionItem.classList.contains('no-results')) return;
        selectPlaceFromSearch(suggestionItem.dataset.place);
    });

    // Закрытие подсказок при клике вне
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#search-container')) {
            suggestionsContainer.style.display = 'none';
            selectedIndex = -1;
        }
    });
}

// Загрузка данных о долгах из Google Sheets
async function loadDebtData() {
    try {
        const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRly3sVX6xZVEMlv4Is1u85pQ2AzEebG2qRLFrM66HgW54AKb9iry-NYwEm4AOjBlHteQDTv_Bt0wkC/pub?gid=1169739178&single=true&output=csv');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        const rawData = parseCSVData(csvText);
        
        // Преобразуем данные в нужный формат
        const debtData = {
            debt_data: {},
            min_balance: 0,
            max_balance: 0,
            sorted_places: [] // Добавляем массив отсортированных участков
        };
        
        let minBalance = Infinity;
        let maxBalance = -Infinity;

        rawData.forEach((row, index) => {
            if (row.number) {
                const normalizedId = normalizePlaceId(row.number.toString());
                debtData.debt_data[normalizedId] = {
                    number: row.number,
                    size: row.size,
                    cost_per_month: row.cost_per_month,
                    cost_per_year: row.cost_per_year,
                    balance: row.balance,
                    start_balance: row.start_balance,
                    paided: row.paided,
                    need_to_paid: row.need_to_paid,
                    months_of_debt: row.months_of_debt,
                    paided_last_month: row.paided_last_month,
                    date: row.date
                };
                
                if (row.balance !== null && row.balance !== undefined && !isNaN(row.balance)) {
                    minBalance = Math.min(minBalance, row.balance);
                    maxBalance = Math.max(maxBalance, row.balance);
                }
            }
        });
        
        debtData.min_balance = minBalance === Infinity ? 0 : minBalance;
        debtData.max_balance = maxBalance === -Infinity ? 0 : maxBalance;
        
        // Сортируем участки по размеру долга (от большего долга к меньшему)
        debtData.sorted_places = Object.keys(debtData.debt_data)
            .map(placeId => ({
                id: placeId,
                balance: debtData.debt_data[placeId].balance,
                number: debtData.debt_data[placeId].number
            }))
            .filter(place => place.balance !== null && place.balance !== undefined && !isNaN(place.balance))
            .sort((a, b) => a.balance - b.balance); // Сортируем от меньшего к большему (от долгов к переплатам)
        
        state.debtData = debtData;

    } catch (error) {
        console.error('Ошибка загрузки данных о долгах из Google Sheets:', error);
    }
}

// Загрузка SVG
async function loadSVG() {
    try {
        const response = await fetch('map.svg');
        const svgText = await response.text();
        
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        
        const container = d3.select('#map-svg');
        container.selectAll('*').remove();
        
        const svgContent = svgElement.innerHTML;
        container.html(svgContent);
        
        setupPlacesInteractivity();
        applyDebtColors();
        createPlaceLabels();
        

    } catch (error) {
        console.error('Ошибка загрузки SVG:', error);
    }
}

// Создание лейблов участков в конце SVG
function createPlaceLabels() {
    const places = d3.selectAll('path[data-place]');

    
    // Создаем контейнер для лейблов в конце SVG
    const labelsContainer = d3.select('#map-svg')
        .append('g')
        .attr('class', 'labels-container');
    
    places.each(function() {
        const placeId = this.getAttribute('data-place');
        const center = getPlaceCenter(this);
        
        // Добавляем лейбл в контейнер
        const label = labelsContainer.append('text')
            .attr('class', 'place-label')
            .attr('data-place', placeId)
            .attr('x', center.x)
            .attr('y', center.y)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '2px')
            .attr('font-weight', 'bold')
            .attr('fill', '#000')
            .attr('pointer-events', 'none')
            .text(placeId);
    });
    

}

// Обновление видимости лейблов без моргания
function updateLabelsVisibility() {
    const currentZoom = d3.zoomTransform(d3.select('#map-svg').node()).k;
    const labels = d3.selectAll('.place-label');
    
    const zoomChanged = Math.abs(currentZoom - state.lastZoomLevel) > 0.1;
    
    if (zoomChanged) {
        state.lastZoomLevel = currentZoom;
        
        if (currentZoom >= config.labelMinZoom) {
            labels.style('opacity', 1);
        } else {
            labels.style('opacity', 0);
        }
    }
}

// Применение цветов долгов
function applyDebtColors() {
    if (!state.debtData) return;
    
    const places = d3.selectAll('path[data-place]');
    
    places.each(function() {
        const placeId = normalizePlaceId(this.getAttribute('data-place'));
        const debtInfo = state.debtData.debt_data[placeId];
        
        if (debtInfo) {
            const color = getDebtColor(
                debtInfo.balance, 
                state.debtData.min_balance, 
                state.debtData.max_balance
            );
            d3.select(this).style('fill', color);
        }
    });
}

// Настройка интерактивности участков
function setupPlacesInteractivity() {
    const places = d3.selectAll('path[data-place]');
    
    places
        .on('click', function(event, d) {
            event.stopPropagation();
            const placeId = normalizePlaceId(this.getAttribute('data-place'));
            selectPlace(placeId);
        })
        .on('mouseenter', function(event, d) {
            if (!state.isDragging) {
                const placeId = normalizePlaceId(this.getAttribute('data-place'));
                showTooltip(event, placeId);
            }
        })
        .on('mouseleave', function(event, d) {
            hideTooltip();
        });
}

// Выбор участка
function selectPlace(placeId) {
    d3.selectAll('path[data-place]').classed('selected', false);
    
    const selectedPath = d3.select(`path[data-place="${placeId}"]`);
    selectedPath.classed('selected', true);
    
    state.selectedPlace = placeId;
}

// Показать тултип с расширенной информацией
function showTooltip(event, placeId) {
    if (!state.debtData) return;
    
    const debtInfo = state.debtData.debt_data[placeId];
    if (!debtInfo) return;
    
    const tooltip = d3.select('#tooltip');
    const tooltipTitle = d3.select('#tooltip-title');
    const tooltipContent = d3.select('#tooltip-content');
    
    tooltipTitle.text(`Участок ${debtInfo.number}`);
    
    // Форматируем баланс с разделителями тысяч
    const formatBalance = (value) => {
        if (value === null || value === undefined) return 0;
        return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    };
    
    // Вычисляем остаток за год с учетом задолженностей
    const remainingForYear = debtInfo.need_to_paid - debtInfo.paided;
    
    tooltipContent.html(`
        <p><strong>Баланс:</strong> ${formatBalance(debtInfo.balance)} ₽</p>
        <p><strong>Месяцев с задолженностью:</strong> ${debtInfo.months_of_debt || 0}</p>
        <p><strong>Оплачено в этом году:</strong> ${formatBalance(debtInfo.paided || 0)} ₽</p>
        <p><strong>Оплачено в этом месяце:</strong> ${formatBalance(debtInfo.paided_last_month || 0)} ₽</p>
        <p><strong>Плата в месяц:</strong> ${formatBalance(debtInfo.cost_per_month || 0)} ₽</p>
        <p><strong>Плата в год:</strong> ${formatBalance(debtInfo.cost_per_year || 0)} ₽</p>
        <p><strong>Осталось за год (с учетом задолженностей):</strong> ${formatBalance(remainingForYear)} ₽</p>
        <p><strong>Размер:</strong> ${debtInfo.size || 'Не указан'}</p>
        <p><strong>Дата актуальности:</strong> ${debtInfo.date || 'Не указана'}</p>
    `);

    
    const [x, y] = d3.pointer(event, document.body);
    tooltip
        .style('left', (x + 10) + 'px')
        .style('top', (y - 10) + 'px')
        .classed('show', true);
}

// Скрыть тултип
function hideTooltip() {
    d3.select('#tooltip').classed('show', false);
}

// Настройка зума
function setupZoom() {
    const svg = d3.select('#map-svg');
    const container = d3.select('#map-container');
    
    state.zoom = d3.zoom()
        .scaleExtent([config.minZoom, config.maxZoom])
        .on('zoom', function(event) {
            svg.attr('transform', event.transform);
            updateLabelsVisibility();
        })
        .on('start', function() {
            state.isDragging = true;
            container.style('cursor', 'grabbing');
        })
        .on('end', function() {
            state.isDragging = false;
            container.style('cursor', 'grab');
        });
    
    svg.call(state.zoom);
}

// Настройка обработчиков событий
function setupEventListeners() {
    d3.select('#zoom-in').on('click', function(event) {
        event.stopPropagation();
        zoomIn();
    });
    
    d3.select('#zoom-out').on('click', function(event) {
        event.stopPropagation();
        zoomOut();
    });
    
    d3.select('#reset-zoom').on('click', function(event) {
        event.stopPropagation();
        resetZoom();
    });
    
    d3.select('#map-container').on('click', function(event) {
        if (event.target === this || event.target.id === 'map-svg') {
            d3.selectAll('path[data-place]').classed('selected', false);
            state.selectedPlace = null;
            hideTooltip();
        }
    });
}

// Функции зума
function zoomIn() {
    const svg = d3.select('#map-svg');
    const currentTransform = d3.zoomTransform(svg.node());
    const newScale = Math.min(currentTransform.k * 1.5, config.maxZoom);
    const newTransform = d3.zoomIdentity.scale(newScale);
    svg.transition().duration(300).call(state.zoom.transform, newTransform);
}

function zoomOut() {
    const svg = d3.select('#map-svg');
    const currentTransform = d3.zoomTransform(svg.node());
    const newScale = Math.max(currentTransform.k / 1.5, config.minZoom);
    const newTransform = d3.zoomIdentity.scale(newScale);
    svg.transition().duration(300).call(state.zoom.transform, newTransform);
}

function resetZoom() {
    const svg = d3.select('#map-svg');
    svg.transition().duration(300).call(state.zoom.transform, d3.zoomIdentity);
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', init);
