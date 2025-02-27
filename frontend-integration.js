/**
 * Tessero Recommendation System - Frontend Integration
 * 
 * This script provides easy-to-use functions to integrate the recommendation
 * system into your existing Tessero website.
 */

class TesseroRecommendations {
  constructor(apiBaseUrl = '/api') {
    this.apiBaseUrl = apiBaseUrl;
    this.currentUserId = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the recommendation system with a user ID
   * @param {string|number} userId - The ID of the current user
   * @returns {Promise} - Resolves when initialization is complete
   */
  async initialize(userId = null) {
    // Set the current user ID (if provided)
    this.currentUserId = userId;
    
    try {
      // Check if the recommendation API is ready
      const status = await this.getApiStatus();
      this.isInitialized = (status.status === 'ready');
      
      console.log(`Tessero Recommendation System initialized for user ${userId || 'anonymous'}`);
      console.log(`API Status: ${status.status}`);
      
      return {
        success: true,
        isReady: this.isInitialized,
        status: status
      };
    } catch (error) {
      console.error('Failed to initialize Tessero Recommendation System:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get the status of the recommendation API
   * @returns {Promise} - Resolves with the API status
   */
  async getApiStatus() {
    const response = await fetch(`${this.apiBaseUrl}/status`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    return await response.json();
  }

  /**
   * Record a user interaction with an event
   * @param {string|number} eventId - The ID of the event
   * @param {string} interactionType - Type of interaction (view, click, wishlist, purchase)
   * @param {number} score - Optional score for the interaction (default: 1.0)
   * @returns {Promise} - Resolves when the interaction is recorded
   */
  async recordInteraction(eventId, interactionType, score = 1.0) {
    if (!this.currentUserId) {
      console.warn('Cannot record interaction: No user ID set');
      return {
        success: false,
        error: 'No user ID set'
      };
    }
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/event-interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: this.currentUserId,
          event_id: eventId,
          interaction_type: interactionType,
          score: score
        })
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Failed to record ${interactionType} interaction for event ${eventId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get personalized event recommendations for the current user
   * @param {Object} options - Filter and display options
   * @param {number} options.count - Number of recommendations to fetch (default: 10)
   * @param {Array} options.categories - Categories to filter by
   * @param {number} options.minPrice - Minimum price
   * @param {number} options.maxPrice - Maximum price
   * @param {string} options.location - Location to filter by
   * @param {string} options.startDate - Start date (YYYY-MM-DD)
   * @param {string} options.endDate - End date (YYYY-MM-DD)
   * @returns {Promise} - Resolves with recommendations
   */
  async getRecommendations(options = {}) {
    if (!this.currentUserId) {
      console.warn('Getting recommendations for anonymous user (cold start)');
      return this.getTrendingEvents(options);
    }
    
    try {
      // Build query parameters
      const queryParams = new URLSearchParams({
        user_id: this.currentUserId,
        count: options.count || 10
      });
      
      if (options.categories) {
        queryParams.append('categories', options.categories.join(','));
      }
      
      if (options.minPrice !== undefined) {
        queryParams.append('min_price', options.minPrice);
      }
      
      if (options.maxPrice !== undefined) {
        queryParams.append('max_price', options.maxPrice);
      }
      
      if (options.location) {
        queryParams.append('location', options.location);
      }
      
      if (options.startDate) {
        queryParams.append('start_date', options.startDate);
      }
      
      if (options.endDate) {
        queryParams.append('end_date', options.endDate);
      }
      
      const response = await fetch(`${this.apiBaseUrl}/recommendations?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get trending events (useful for anonymous users or as a fallback)
   * @param {Object} options - Filter and display options
   * @param {number} options.count - Number of trending events to fetch (default: 10)
   * @param {Array} options.categories - Categories to filter by
   * @param {string} options.location - Location to filter by
   * @returns {Promise} - Resolves with trending events
   */
  async getTrendingEvents(options = {}) {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams({
        count: options.count || 10
      });
      
      if (options.categories) {
        queryParams.append('categories', options.categories.join(','));
      }
      
      if (options.location) {
        queryParams.append('location', options.location);
      }
      
      const response = await fetch(`${this.apiBaseUrl}/trending-events?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to get trending events:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get events similar to a specific event
   * @param {string|number} eventId - The ID of the event
   * @param {number} count - Number of similar events to fetch (default: 5)
   * @returns {Promise} - Resolves with similar events
   */
  async getSimilarEvents(eventId, count = 5) {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/similar-events/${eventId}?count=${count}`
      );
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Failed to get events similar to ${eventId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Render recommendations into a container element
   * @param {string|HTMLElement} container - CSS selector or DOM element to render into
   * @param {Object} options - Options for fetching and rendering
   * @param {Function} templateFn - Custom template function (receives event object, returns HTML string)
   * @returns {Promise} - Resolves when rendering is complete
   */
  async renderRecommendations(container, options = {}, templateFn = null) {
    const containerEl = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!containerEl) {
      console.error(`Container not found: ${container}`);
      return {
        success: false,
        error: 'Container element not found'
      };
    }
    
    try {
      // Show loading state
      containerEl.innerHTML = '<div class="tessero-loading">Loading recommendations...</div>';
      
      // Get recommendations
      const response = await this.getRecommendations(options);
      
      if (!response.recommendations || response.recommendations.length === 0) {
        containerEl.innerHTML = '<div class="tessero-empty">No recommendations found</div>';
        return {
          success: true,
          count: 0
        };
      }
      
      // Render recommendations
      let html = '';
      
      if (templateFn) {
        // Use custom template function
        html = response.recommendations.map(templateFn).join('');
      } else {
        // Use default template
        html = `
          <div class="tessero-recommendations">
            ${response.recommendations.map(event => `
              <div class="tessero-event-card" data-event-id="${event.event_id}">
                <h3 class="tessero-event-title">${event.title}</h3>
                <div class="tessero-event-details">
                  <span class="tessero-event-category">${event.category}</span>
                  <span class="tessero-event-location">${event.location}</span>
                  <span class="tessero-event-date">${event.date}</span>
                  <span class="tessero-event-price">$${event.price.toFixed(2)}</span>
                </div>
                <p class="tessero-event-description">${
                  event.description.length > 100 
                    ? event.description.substring(0, 100) + '...' 
                    : event.description
                }</p>
                <a href="/events/${event.event_id}" class="tessero-event-link">View Event</a>
              </div>
            `).join('')}
          </div>
        `;
      }
      
      // Update container
      containerEl.innerHTML = html;
      
      // Add event listeners for interaction tracking
      containerEl.querySelectorAll('[data-event-id]').forEach(element => {
        const eventId = element.dataset.eventId;
        
        // Track views
        this.recordInteraction(eventId, 'view');
        
        // Track clicks
        element.addEventListener('click', () => {
          this.recordInteraction(eventId, 'click');
        });
      });
      
      return {
        success: true,
        count: response.recommendations.length
      };
    } catch (error) {
      console.error('Failed to render recommendations:', error);
      containerEl.innerHTML = `<div class="tessero-error">Error loading recommendations</div>`;
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Render similar events for a specific event
   * @param {string|number} eventId - The ID of the event
   * @param {string|HTMLElement} container - CSS selector or DOM element to render into
   * @param {Object} options - Options for rendering
   * @param {number} options.count - Number of similar events to fetch (default: 5)
   * @param {Function} templateFn - Custom template function
   * @returns {Promise} - Resolves when rendering is complete
   */
  async renderSimilarEvents(eventId, container, options = {}, templateFn = null) {
    const containerEl = typeof container === 'string' 
      ? document.querySelector(container) 
      : container;
    
    if (!containerEl) {
      console.error(`Container not found: ${container}`);
      return {
        success: false,
        error: 'Container element not found'
      };
    }
    
    try {
      // Show loading state
      containerEl.innerHTML = '<div class="tessero-loading">Loading similar events...</div>';
      
      // Get similar events
      const response = await this.getSimilarEvents(eventId, options.count || 5);
      
      if (!response.similar_events || response.similar_events.length === 0) {
        containerEl.innerHTML = '<div class="tessero-empty">No similar events found</div>';
        return {
          success: true,
          count: 0
        };
      }
      
      // Render similar events
      let html = '';
      
      if (templateFn) {
        // Use custom template function
        html = response.similar_events.map(templateFn).join('');
      } else {
        // Use default template
        html = `
          <div class="tessero-similar-events">
            <h2>Similar Events</h2>
            ${response.similar_events.map(event => `
              <div class="tessero-event-card" data-event-id="${event.event_id}">
                <h3 class="tessero-event-title">${event.title}</h3>
                <div class="tessero-event-details">
                  <span class="tessero-event-category">${event.category}</span>
                  <span class="tessero-event-location">${event.location}</span>
                  <span class="tessero-event-date">${event.date}</span>
                  <span class="tessero-event-price">$${event.price.toFixed(2)}</span>
                </div>
                <p class="tessero-event-description">${
                  event.description.length > 100 
                    ? event.description.substring(0, 100) + '...' 
                    : event.description
                }</p>
                <div class="tessero-similarity">
                  Similarity: ${Math.round(event.similarity_score * 100)}%
                </div>
                <a href="/events/${event.event_id}" class="tessero-event-link">View Event</a>
              </div>
            `).join('')}
          </div>
        `;
      }
      
      // Update container
      containerEl.innerHTML = html;
      
      // Add event listeners for interaction tracking
      containerEl.querySelectorAll('[data-event-id]').forEach(element => {
        const similarEventId = element.dataset.eventId;
        
        // Track views
        this.recordInteraction(similarEventId, 'view');
        
        // Track clicks
        element.addEventListener('click', () => {
          this.recordInteraction(similarEventId, 'click');
        });
      });
      
      return {
        success: true,
        count: response.similar_events.length
      };
    } catch (error) {
      console.error('Failed to render similar events:', error);
      containerEl.innerHTML = `<div class="tessero-error">Error loading similar events</div>`;
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Example usage:
// 
// 1. Initialize the recommendation system
// const tesseroRecommender = new TesseroRecommendations();
// 
// 2. Set up the system with the current user ID (if logged in)
// tesseroRecommender.initialize(currentUserId);
// 
// 3. Render personalized recommendations on the home page
// tesseroRecommender.renderRecommendations('#recommended-events-container', {
//   count: 6,
//   categories: ['Concert', 'Festival']
// });
// 
// 4. Render similar events on an event details page
// tesseroRecommender.renderSimilarEvents(eventId, '#similar-events-container');
// 
// 5. Track user interactions manually (for custom UI elements)
// document.querySelector('#add-to-wishlist-button').addEventListener('click', () => {
//   tesseroRecommender.recordInteraction(eventId, 'wishlist');
// });

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TesseroRecommendations;
} else {
  window.TesseroRecommendations = TesseroRecommendations;
}
