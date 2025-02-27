from flask import Flask, request, jsonify
from tessero_recommendation_engine import TesseroRecommendationEngine
import pandas as pd
import numpy as np
from datetime import datetime
import os
import logging

app = Flask(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("recommendation_api.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize the recommendation engine
recommendation_engine = None
MODEL_PATH = "tessero_recommendation_model.pkl"

def initialize_engine():
    """Initialize or load the recommendation engine"""
    global recommendation_engine
    
    try:
        if os.path.exists(MODEL_PATH):
            # Load existing model
            logger.info(f"Loading existing model from {MODEL_PATH}")
            recommendation_engine = TesseroRecommendationEngine()
            recommendation_engine.load_model(MODEL_PATH)
        else:
            # Initialize new model
            logger.info("Creating new recommendation engine")
            recommendation_engine = TesseroRecommendationEngine()
            
            
            
            logger.info("Model will be trained when data is provided")
    
    except Exception as e:
        logger.error(f"Error initializing recommendation engine: {str(e)}")
        recommendation_engine = None


@app.route('/api/recommendations', methods=['GET'])
def get_recommendations():
    """
    Get personalized recommendations for a user
    
    Query parameters:
    - user_id: ID of the user (required)
    - count: Number of recommendations to return (default: 10)
    - categories: Comma-separated list of categories to filter by
    - min_price: Minimum price
    - max_price: Maximum price
    - location: Location to filter by
    - start_date: Start date (format: YYYY-MM-DD)
    - end_date: End date (format: YYYY-MM-DD)
    """
    if recommendation_engine is None:
        return jsonify({"error": "Recommendation engine not initialized"}), 500
    
    # Get request parameters
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    
    try:
        # Convert user_id to the appropriate type
        user_id = int(user_id) if user_id.isdigit() else user_id
        
        count = int(request.args.get('count', 10))
        
        # Build filter parameters
        filter_params = {}
        
        if 'categories' in request.args:
            filter_params['categories'] = request.args.get('categories').split(',')
        
        if 'min_price' in request.args:
            filter_params['min_price'] = float(request.args.get('min_price'))
        
        if 'max_price' in request.args:
            filter_params['max_price'] = float(request.args.get('max_price'))
        
        if 'location' in request.args:
            filter_params['location'] = request.args.get('location')
        
        if 'start_date' in request.args:
            filter_params['start_date'] = datetime.strptime(request.args.get('start_date'), '%Y-%m-%d')
        
        if 'end_date' in request.args:
            filter_params['end_date'] = datetime.strptime(request.args.get('end_date'), '%Y-%m-%d')
        
        # Get recommendations
        recommendations = recommendation_engine.get_personalized_recommendations(
            user_id=user_id,
            n=count,
            filter_params=filter_params if filter_params else None
        )
        
        # If no recommendations found for the user, try cold start recommendations
        if not recommendations:
            logger.info(f"No personalized recommendations found for user {user_id}, using cold start")
            recommendations = recommendation_engine.get_cold_start_recommendations(
                n=count,
                filter_params=filter_params if filter_params else None
            )
        
        # Convert to serializable format
        response_data = []
        for rec in recommendations:
            rec_data = {k: v for k, v in rec.items()}
            
            # Convert datetime to string
            if 'date' in rec_data and isinstance(rec_data['date'], datetime):
                rec_data['date'] = rec_data['date'].strftime('%Y-%m-%d')
            
            # Format price
            if 'price' in rec_data:
                rec_data['price'] = float(rec_data['price'])
            
            response_data.append(rec_data)
        
        return jsonify({
            "user_id": user_id,
            "count": len(response_data),
            "recommendations": response_data
        })
    
    except Exception as e:
        logger.error(f"Error getting recommendations: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/train', methods=['POST'])
def train_model():
    """
    Train or retrain the recommendation model
    
    JSON payload:
    - user_event_data: List of user-event interactions
    - event_features_data: List of event features
    - user_profiles_data: List of user profiles
    
    Or you can use your database connector by not providing these parameters
    """
    if recommendation_engine is None:
        initialize_engine()
        if recommendation_engine is None:
            return jsonify({"error": "Failed to initialize recommendation engine"}), 500
    
    try:
        data = request.json
        
        if data and 'user_event_data' in data and 'event_features_data' in data:
            # Convert JSON data to DataFrames
            user_event_df = pd.DataFrame(data['user_event_data'])
            event_features_df = pd.DataFrame(data['event_features_data'])
            
            user_profiles_df = None
            if 'user_profiles_data' in data and data['user_profiles_data']:
                user_profiles_df = pd.DataFrame(data['user_profiles_data'])
            
            # Load data and train model
            recommendation_engine.load_data(
                user_event_df=user_event_df,
                event_features_df=event_features_df,
                user_profiles_df=user_profiles_df
            )
        
        # Train model
        recommendation_engine.train()
        
        # Save the trained model
        recommendation_engine.save_model(MODEL_PATH)
        
        return jsonify({
            "success": True,
            "message": "Model trained successfully",
            "training_time": recommendation_engine.last_training_time.strftime('%Y-%m-%d %H:%M:%S')
        })
    
    except Exception as e:
        logger.error(f"Error training model: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/event-interactions', methods=['POST'])
def record_event_interaction():
    """
    Record a user's interaction with an event
    
    JSON payload:
    - user_id: ID of the user
    - event_id: ID of the event
    - interaction_type: Type of interaction (view, click, wishlist, purchase)
    - score: Interaction score (optional, default: 1.0)
    """
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['user_id', 'event_id', 'interaction_type']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Get parameters
        user_id = data['user_id']
        event_id = data['event_id']
        interaction_type = data['interaction_type']
        score = data.get('score', 1.0)
        
        # Here you would save this interaction to your database
        # For this example, we'll just log it
        logger.info(f"Recorded interaction: User {user_id} {interaction_type} Event {event_id} with score {score}")
        
        # You could implement a queuing system here for batch processing
        # of interactions to update the model periodically
        
        return jsonify({
            "success": True,
            "message": "Interaction recorded successfully"
        })
    
    except Exception as e:
        logger.error(f"Error recording interaction: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/status', methods=['GET'])
def get_status():
    """Get the status of the recommendation engine"""
    if recommendation_engine is None:
        return jsonify({
            "status": "not_initialized",
            "message": "Recommendation engine not initialized"
        })
    
    if not hasattr(recommendation_engine, 'last_training_time') or recommendation_engine.last_training_time is None:
        return jsonify({
            "status": "initialized",
            "message": "Recommendation engine initialized but not trained"
        })
    
    return jsonify({
        "status": "ready",
        "last_trained": recommendation_engine.last_training_time.strftime('%Y-%m-%d %H:%M:%S'),
        "event_count": len(recommendation_engine.event_ids) if hasattr(recommendation_engine, 'event_ids') else 0,
        "user_count": len(recommendation_engine.user_ids) if hasattr(recommendation_engine, 'user_ids') else 0
    })


@app.route('/api/similar-events/<event_id>', methods=['GET'])
def get_similar_events(event_id):
    """
    Get events similar to the provided event_id
    
    Path parameters:
    - event_id: ID of the event
    
    Query parameters:
    - count: Number of similar events to return (default: 5)
    """
    if recommendation_engine is None:
        return jsonify({"error": "Recommendation engine not initialized"}), 500
    
    try:
        # Convert event_id to the appropriate type
        event_id = int(event_id) if event_id.isdigit() else event_id
        count = int(request.args.get('count', 5))
        
        # Check if event_id exists
        if event_id not in recommendation_engine.event_ids:
            return jsonify({"error": f"Event ID {event_id} not found"}), 404
        
        # Get the index of the event
        event_idx = recommendation_engine.event_ids.index(event_id)
        
        # Get the similarity scores for this event
        similarity_scores = recommendation_engine.event_similarity_matrix[event_idx]
        
        # Get the most similar events (excluding the event itself)
        similar_events = []
        for idx, score in enumerate(similarity_scores):
            if idx != event_idx:
                similar_events.append((recommendation_engine.event_ids[idx], score))
        
        # Sort by similarity score and take the top 'count'
        similar_events.sort(key=lambda x: x[1], reverse=True)
        top_similar_events = similar_events[:count]
        
        # Get the event details
        response_data = []
        for similar_event_id, similarity_score in top_similar_events:
            event_details = recommendation_engine.event_features_df[
                recommendation_engine.event_features_df['event_id'] == similar_event_id
            ].to_dict('records')
            
            if event_details:
                event_data = event_details[0]
                
                # Convert datetime to string
                if 'date' in event_data and isinstance(event_data['date'], datetime):
                    event_data['date'] = event_data['date'].strftime('%Y-%m-%d')
                
                # Format price
                if 'price' in event_data:
                    event_data['price'] = float(event_data['price'])
                
                event_data['similarity_score'] = float(similarity_score)
                response_data.append(event_data)
        
        return jsonify({
            "event_id": event_id,
            "count": len(response_data),
            "similar_events": response_data
        })
    
    except Exception as e:
        logger.error(f"Error getting similar events: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/trending-events', methods=['GET'])
def get_trending_events():
    """
    Get trending events based on recent user interactions
    
    Query parameters:
    - count: Number of trending events to return (default: 10)
    - days: Consider interactions from the last N days (default: 7)
    - categories: Comma-separated list of categories to filter by
    - location: Location to filter by
    """
    if recommendation_engine is None:
        return jsonify({"error": "Recommendation engine not initialized"}), 500
    
    try:
        count = int(request.args.get('count', 10))
        
        # In a real implementation, you would query your database for recent interactions
        # For this example, we'll just use the cold start recommendations as a proxy
        
        # Build filter parameters
        filter_params = {}
        
        if 'categories' in request.args:
            filter_params['categories'] = request.args.get('categories').split(',')
        
        if 'location' in request.args:
            filter_params['location'] = request.args.get('location')
        
        trending_events = recommendation_engine.get_cold_start_recommendations(
            n=count,
            filter_params=filter_params if filter_params else None
        )
        
        # Convert to serializable format
        response_data = []
        for event in trending_events:
            event_data = {k: v for k, v in event.items()}
            
            # Convert datetime to string
            if 'date' in event_data and isinstance(event_data['date'], datetime):
                event_data['date'] = event_data['date'].strftime('%Y-%m-%d')
            
            # Format price
            if 'price' in event_data:
                event_data['price'] = float(event_data['price'])
            
            response_data.append(event_data)
        
        return jsonify({
            "count": len(response_data),
            "trending_events": response_data
        })
    
    except Exception as e:
        logger.error(f"Error getting trending events: {str(e)}")
        return jsonify({"error": str(e)}), 500


# Initialize the recommendation engine when the application starts
@app.before_first_request
def before_first_request():
    initialize_engine()


if __name__ == '__main__':
    # Initialize the engine
    initialize_engine()
    
    # Run the Flask application
    app.run(debug=True, host='0.0.0.0', port=5000)
