'use client'
import React, { useState, useEffect } from 'react';

const organizeByTypeAndDate = (data) => {
    const mergedData = [...data.result1, ...data.result2];
  
    const groupedByTypeAndDate = mergedData.reduce((acc, item) => {
      const type = item.type;
      const date = item.timeline[0].date_init.split('T')[0]; // Extracting the date part (YYYY-MM-DD)
  
      if (!acc[type]) {
        acc[type] = {};
      }
  
      if (!acc[type][date]) {
        acc[type][date] = [];
      }
  
      acc[type][date].push(item);
  
      return acc;
    }, {});
  
    for (const type in groupedByTypeAndDate) {
      for (const date in groupedByTypeAndDate[type]) {
        groupedByTypeAndDate[type][date].sort((a, b) => {
          const dateA = new Date(a.timeline[0].date_init);
          const dateB = new Date(b.timeline[0].date_init);
          return dateA - dateB;
        });
      }
    }
  
    return groupedByTypeAndDate;
  };
  
  const App = () => {
    const [data, setData] = useState(null);
    const [selectedType, setSelectedType] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [availableDates, setAvailableDates] = useState([]);
    const [events, setEvents] = useState([]);
  
    useEffect(() => {
      const fetchData = async () => {
        try {
          const response = await fetch('/api/inauthenticated/get/programacao');
          const result = await response.json();
          setData(result);
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      };
  
      fetchData();
    }, []);
  
    useEffect(() => {
      if (data) {
        const organizedData = organizeByTypeAndDate(data);
        if (selectedType && selectedDate) {
          setEvents(organizedData[selectedType][selectedDate] || []);
        }
      }
    }, [data, selectedType, selectedDate]);
  
    const handleTypeClick = (type) => {
      setSelectedType(type);
      if (data) {
        const dates = Object.keys(organizeByTypeAndDate(data)[type] || {});
        setAvailableDates(dates);
        setSelectedDate(dates.length > 0 ? dates[0] : '');
      }
    };
  
    const handleDateClick = (date) => {
      setSelectedDate(date);
    };
  
    useEffect(() => {
      if (selectedType && selectedDate && data) {
        const organizedData = organizeByTypeAndDate(data);
        setEvents(organizedData[selectedType][selectedDate] || []);
      }
    }, [selectedType, selectedDate, data]);
  
    return (
      <div className="p-4">
        <div className="mb-4">
          <h2 className="text-lg font-bold mb-2">Tipo:</h2>
          <div className="flex flex-wrap gap-2">
            {data && Object.keys(organizeByTypeAndDate(data)).map(type => (
              <button
                key={type}
                onClick={() => handleTypeClick(type)}
                className={`p-2 border rounded ${selectedType === type ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
  
        {availableDates.length > 0 && (
          <div className="mb-4">
            <h2 className="text-lg font-bold mb-2">Data:</h2>
            <div className="flex flex-wrap gap-2">
              {availableDates.map(date => (
                <button
                  key={date}
                  onClick={() => handleDateClick(date)}
                  className={`p-2 border rounded ${selectedDate === date ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                >
                  {date}
                </button>
              ))}
            </div>
          </div>
        )}
  
        <div>
          {events.length > 0 ? (
            <ul>
              {events.map(event => (
                <li key={event._id} className="mb-4 p-4 border rounded">
                  <h2 className="text-xl font-bold">{event.name}</h2>
                  <p>{event.description}</p>
                  <p><strong>Local:</strong> {event.timeline[0].local_description}</p>
                  <p><strong>Início:</strong> {new Date(event.timeline[0].date_init).toLocaleString()}</p>
                  <p><strong>Fim:</strong> {new Date(event.timeline[0].date_end).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhum evento encontrado.</p>
          )}
        </div>
      </div>
    );
  };
  
  export default App;