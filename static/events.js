// static/events.js

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const eventsListContainer = document.getElementById('events-list-container');
    const createEventBtn = document.getElementById('create-event-btn');
    const createEventModal = document.getElementById('create-event-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelEventBtn = document.getElementById('cancel-event-btn');
    const createEventForm = document.getElementById('create-event-form');
    const submitEventBtn = document.getElementById('submit-event-btn');

    // Get current user ID from the HTML (assuming it's passed from Flask session)
    // This expects <body data-user-id="{{ session.get('user_id', 'anonymous') }}"> in your events.html
    const currentUserId = document.body.dataset.userId || 'anonymous';
    console.log("Current User ID:", currentUserId);


    // Function to open the modal
    function openModal() {
        createEventModal.style.display = 'flex'; // Use flex to center
        // Reset form fields
        createEventForm.reset(); 
    }

    // Function to close the modal
    function closeModal() {
        createEventModal.style.display = 'none';
    }

    // Event Listeners for Modal
    if (createEventBtn) {
        createEventBtn.addEventListener('click', openModal);
    }
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    if (cancelEventBtn) {
        cancelEventBtn.addEventListener('click', closeModal);
    }

    // Close modal if user clicks outside of it
    window.addEventListener('click', (event) => {
        if (event.target === createEventModal) {
            closeModal();
        }
    });

    // Function to fetch and display events
    async function fetchAndDisplayEvents() {
        try {
            eventsListContainer.innerHTML = '<p>Loading events...</p>'; // Show loading message
            const response = await fetch('/api/events');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const events = await response.json();

            eventsListContainer.innerHTML = ''; // Clear loading message

            if (events.length === 0) {
                eventsListContainer.innerHTML = '<p>No upcoming events found. Be the first to create one!</p>';
                return;
            }

            events.forEach(event => {
                const eventItem = document.createElement('div');
                eventItem.classList.add('event-item');

                const eventDate = new Date(event.date);
                const day = eventDate.getDate();
                const month = eventDate.toLocaleString('default', { month: 'short' }).toUpperCase();

                // Determine if the current user has joined this event
                // Check if participants array exists and includes the currentUserId
                const hasJoined = event.participants && event.participants.includes(currentUserId) && currentUserId !== 'anonymous';
                const joinButtonText = hasJoined ? 'Joined' : 'Join';
                const joinButtonClass = hasJoined ? 'interested-btn joined' : 'interested-btn';
                const joinButtonDisabled = hasJoined ? 'disabled' : ''; // Add disabled attribute if already joined

                eventItem.innerHTML = `
                    <div class="event-date">
                        <span class="day">${day}</span>
                        <span class="month">${month}</span>
                    </div>
                    <div class="event-details">
                        <h3>${event.title}</h3>
                        <p><i class="fas fa-map-marker-alt"></i> ${event.location}</p>
                        <p><i class="fas fa-clock"></i> ${event.time}</p>
                        <p class="event-description">${event.description || 'No description provided.'}</p>
                        <div class="event-stat">
                            <i class="fas fa-users"></i> ${event.participants_count || 0} participants
                        </div>
                    </div>
                    <div class="event-actions">
                        <button class="${joinButtonClass}" data-event-id="${event._id}" ${joinButtonDisabled}>${joinButtonText}</button>
                        <button class="share-btn"><i class="fas fa-share"></i> Share</button>
                    </div>
                `;
                eventsListContainer.appendChild(eventItem);
            });

            // Attach event listeners to all "Join" buttons AFTER they are added to the DOM
            document.querySelectorAll('.interested-btn').forEach(button => {
                // Only add click listener if the button is not already disabled
                if (!button.disabled) {
                    button.addEventListener('click', async (e) => {
                        const eventId = e.target.dataset.eventId; // Get the event ID from data attribute
                        console.log(`User attempting to join event: ${eventId}`);

                        e.target.textContent = 'Joining...';
                        e.target.disabled = true; // Temporarily disable button
                        e.target.style.backgroundColor = '#cccccc'; // Temp color

                        try {
                            const response = await fetch(`/api/events/${eventId}/join`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                                // No body needed for this simple join, user_id is from session on backend
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                            }

                            const result = await response.json();
                            console.log('Join event response:', result);
                            
                            // Re-fetch and re-display all events to update counts and button states
                            // This ensures all events reflect the latest participant counts and the current user's joined status
                            await fetchAndDisplayEvents(); 

                        } catch (error) {
                            console.error('Error joining event:', error);
                            alert(`Failed to join event: ${error.message}`);
                            // Revert button state if joining failed
                            e.target.textContent = 'Join';
                            e.target.disabled = false;
                            e.target.style.backgroundColor = ''; // Revert color
                        }
                    });
                }
            });


        } catch (error) {
            console.error('Error fetching events:', error);
            eventsListContainer.innerHTML = '<p class="error-message">Failed to load events. Please try again later.</p>';
        }
    }

    // Handle form submission for creating a new event
    createEventForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        submitEventBtn.disabled = true; // Disable button to prevent double submission
        submitEventBtn.textContent = 'Creating...';

        const newEvent = {
            title: document.getElementById('event-title').value,
            date: document.getElementById('event-date').value,
            time: document.getElementById('event-time').value,
            location: document.getElementById('event-location').value,
            description: document.getElementById('event-description').value
        };

        try {
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newEvent)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Event created:', result);
            alert('Event created successfully!'); // Simple alert for success
            closeModal(); // Close the modal
            fetchAndDisplayEvents(); // Refresh the event list

        } catch (error) {
            console.error('Error creating event:', error);
            alert(`Failed to create event: ${error.message}`); // Show error message to user
        } finally {
            submitEventBtn.disabled = false; // Re-enable button
            submitEventBtn.textContent = 'Create Event';
        }
    });

    // Initial fetch of events when the page loads
    fetchAndDisplayEvents();
});
