from flask import Flask, request, jsonify, session, render_template, redirect, url_for
from pymongo import MongoClient
import bcrypt
from flask_session import Session
from bson.objectid import ObjectId
from functools import wraps
import os
import re
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash # Added these imports
import uuid # Import for generating unique tokens
import secrets # Good for generating strong random tokens
import json

from dotenv import load_dotenv


load_dotenv()

import uuid # ADDED: For more robust unique filenames

app = Flask(__name__)

app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'super_secret_key_')

MONGO_URI_ATLAS_OR_LOCAL = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/college_connect')
    
app.config['MONGO_URI'] = MONGO_URI_ATLAS_OR_LOCAL
app.config["SESSION_PERMANENT"] = True
app.config["SESSION_TYPE"] = "mongodb"
    
app.config["SESSION_MONGODB"] = MongoClient(MONGO_URI_ATLAS_OR_LOCAL)
app.config["SESSION_MONGODB_DB"] = "college_connect_sessions"
app.config["SESSION_MONGODB_COLLECTIONS"] = "sessions"

Session(app)

db = MongoClient(MONGO_URI_ATLAS_OR_LOCAL)['college_connect_db']

print(f"Flask App configured with MONGO_URI: {MONGO_URI_ATLAS_OR_LOCAL.split('@')[-1].split('/')[0]}")
print(f"Main database for app data: {db.name}")
print(f"Database for Flask sessions: {app.config['SESSION_MONGODB_DB']}")
# --- Configuration for File Uploads ---
UPLOAD_FOLDER = 'static/uploads/posts'  # For post images
COMMUNITY_UPLOAD_FOLDER = 'static/uploads/community_pics'  # For community images
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['COMMUNITY_UPLOAD_FOLDER'] = COMMUNITY_UPLOAD_FOLDER

# Ensure upload folders exist when the app starts
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(COMMUNITY_UPLOAD_FOLDER):
    os.makedirs(COMMUNITY_UPLOAD_FOLDER)

def allowed_file(filename):
    #this function is used to make sure the user puts in the correct extensin for files such as png, jpg 
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

mongo = MongoClient(app.config['MONGO_URI'])
db = mongo.db

def login_required(f):
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    decorated_function.__name__= f.__name__
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = session.get('user')
        if not user or not user.get('is_admin'):
            return redirect(url_for('home'))  # Or return 403 JSON
        return f(*args, **kwargs)
    return decorated_function

def send_password_reset_email_mock(to_email, reset_link):
    """
    Mocks sending a password reset email.
    In a real application, you would integrate with an email service (e.g., SendGrid, Mailgun, or smtplib).
    """
    print(f"\n--- MOCK EMAIL SENT ---")
    print(f"To: {to_email}")
    print(f"Subject: Password Reset Request for College Connect")
    print(f"Body: You requested a password reset. Please click the following link to reset your password:")
    print(f"      {reset_link}")
    print(f"This link is valid for 1 hour. If you did not request this, please ignore this email.")
    print(f"-----------------------\n")
# --- Core Routes ---

@app.route('/')
def landing_page():
    # You can add logic here later, e.g., to check if user is logged in
    return render_template('index.html')

@app.route('/index.html', methods=['GET'])
@login_required # Assuming your home page requires users to be logged in
def index():
    user_id = session.get('user_id') # Get the current user's ID from the session

    # If for some reason user_id is missing despite login_required (e.g., session corruption)
    if not user_id:
        # Clear any stale session data and redirect to login
        session.pop('user_id', None)
        session.pop('user', None)
        return redirect(url_for('login_page')) # Make sure 'login_page' is your actual login route name

    try:
        user_obj_id = ObjectId(user_id)
        current_user = db.users.find_one({'_id': user_obj_id})

        if not current_user:
            # User not found in DB (e.g., deleted account while logged in)
            session.pop('user_id', None)
            session.pop('user', None)
            return redirect(url_for('login_page'))

        # Ensure profile_pic_url exists and has a fallback to a default image
        if 'profile_pic_url' not in current_user or not current_user['profile_pic_url']:
            current_user['profile_pic_url'] = url_for('static', filename='default-profile.jpg')
        
        # Pass the entire current_user object to the template
        # The 'is_admin' variable is also passed for conditional rendering in HTML
        return render_template('home.html', user=current_user, is_admin=session.get('is_admin', False))

    except Exception as e:
        print(f"Error loading home page for user {user_id}: {e}")
        # In case of an error fetching user data, redirect to login or show generic error
        session.pop('user_id', None)
        session.pop('user', None)
        return redirect(url_for('login_page'))

@app.route('/home', methods=['GET'])
@login_required # <--- ADD THIS DECORATOR to ensure user is logged in
def home():
    """
    Renders the home page for logged-in users,
    passing user data and admin status to the template.
    """
    user_id = session.get('user_id')
    logged_in_user = None
    is_admin = False

    if user_id: # This check is technically redundant with @login_required, but harmless
        logged_in_user = db.users.find_one({'_id': ObjectId(user_id)})
        if logged_in_user:
            is_admin = logged_in_user.get('is_admin', False) # Safely get admin status

    # Pass the user object and admin status to the template
    return render_template('home.html', is_admin=is_admin, user=logged_in_user)

@app.context_processor
def inject_user():
    if 'user_id' in session:
        user = db.users.find_one({'_id': ObjectId(session['user_id'])})
        return dict(user=user)
    return dict(user=None)



@app.route('/register', methods=['GET'])
def register_page():
    return render_template('register.html')

@app.route('/register', methods=['POST'])
def register():
    print("----- Registration Attempt -----")
    data = request.get_json()
    print("Received data:", data)
    name = data.get('name')
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    course = data.get('course')
    college_id = data.get('college_id')

    print("Checking for existing username...")
    if db.users.find_one({'username': username}):
        print(f"Error: Username '{username}' already exists")
        return jsonify({'message': 'username already exists'}), 409

    print("Checking for existing email...")
    if db.users.find_one({'email': email}):
        print(f"Error: Email '{email}' is already registered")
        return jsonify({'message': 'email is already registered'}), 409

    print("Checking for existing college_id...")
    if db.users.find_one({'college_id': college_id}):
        print(f"Error: College ID '{college_id}' is already registered")
        return jsonify({'message': 'college_id is already registered'}), 409

    if len(password) < 8:
        return jsonify({'message': 'Password must be at least 8 characters long'}), 400
    if not re.search(r"[A-Z]", password):
        return jsonify({'message': 'Password must contain at least one uppercase letter'}), 400
    if not re.search(r"[a-z]", password):
        return jsonify({'message': 'Password must contain at least one lowercase letter'}), 400
    if not re.search(r"[0-9]", password):
        return jsonify({'message': 'Password must contain at least one number'}), 400
    if not re.search(r"[!@#$%^&*()_+=\[\]{};':\"\\|,.<>\/?]", password):
        return jsonify({'message': 'Password must contain at least one special symbol'}), 400

    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    try:
        user_id = db.users.insert_one({
            'name': name,
            'username': username,
            'password': hashed_password,
            'email': email,
            'course': course,
            'college_id': college_id
        }).inserted_id
        print(f"Registration successful for user ID: {user_id}")
        return jsonify({
            'message': 'user registration successful',
            'user_id': str(user_id)
        }), 201
    except Exception as e:
        print(f"Error during database insertion: {e}")
        return jsonify({'message': 'An error occurred during registration'}), 500

@app.route('/login', methods=['GET'])
def login_page():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    print("------------------ Login Attempt ------------------")
    data = request.get_json() # Assumes front-end sends JSON. If it's form data, use request.form.get()
    print("Received data:", data)
    username = data.get('username')
    password = data.get('password')

    print("Username entered:", username)

    if not username or not password:
        print("Error: Missing username or password")
        return jsonify({'message': 'Username and password are required'}), 400

    user = db.users.find_one({'username': username})

    if user:
        print("Found user in database:", user.get('username'))
        if bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            # --- THIS IS THE KEY CHANGE ---
            # 1. Convert MongoDB's ObjectId to a string because session data needs to be simple (JSON-serializable)
            user['_id'] = str(user['_id'])
            
            # 2. IMPORTANT: Remove sensitive data like the password hash before storing user info in the session
            user.pop('password', None)
            
            # 3. Store the entire user dictionary (now clean and with string _id) into session['user']
            session['user'] = user
            
            # You can keep session['user_id'] if other parts of your code still use it,
            # but session['user']['_id'] is now the primary way to get the ID.
            session['user_id'] = user['_id'] 
            
            print("Login successful, session['user']['_id']:", session['user']['_id'])
            return jsonify({'message': 'Login successful', 'user_id': user['_id'], 'redirect':url_for('home')}), 200
        else:
            print("Error: Invalid password for user:", username)
            return jsonify({'message': 'Invalid username or password'}), 401
    else:
        print("Error: User not found:", username)
        return jsonify({'message': 'Invalid username or password'}), 401


# --- General Search API Endpoint ---
@app.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('query', '').strip()
    search_type = request.args.get('type', 'all')

    if not query:
        return jsonify({'message': 'Search query is required.', 'results': []}), 400

    regex = {'$regex': query, '$options': 'i'}  # case-insensitive search
    results = []

    # --- Search People ---
    if search_type in ['all', 'user', 'people']:
        users = db.users.find({'$or': [{'username': regex}, {'name': regex}]})
        for user in users:
            results.append({
                'type': 'user',
                'username': user.get('username'),
                'name': user.get('name', 'No Name')
            })

    # --- Search Communities ---
    if search_type in ['all', 'community', 'communities']:
        communities = db.communities.find({'name': regex})
        for community in communities:
            results.append({
                'type': 'community',
                'name': community.get('name'),
                'description': community.get('description', ''),
                'members_count': len(community.get('members', []))
            })

    # --- Search Events ---
    if search_type in ['all', 'event', 'events']:
        events = db.events.find({'$or': [{'title': regex}, {'location': regex}]})
        for event in events:
            results.append({
                'type': 'event',
                'title': event.get('title'),
                'location': event.get('location', ''),
                'date': event.get('date', '')
            })

    return jsonify({'results': results}), 200

@app.route('/search_results', methods=['GET'])
def search_results_page():
    # Get the search query from the URL parameters
    query = request.args.get('query', '')
    # Render the search.html template and pass the query as initial_query
    return render_template('search.html', initial_query=query)






#this is the route for info on communities 
#1) route to enter community home page
@app.route('/communities', methods=['GET'])
@login_required
def communities():
    return render_template('communities.html')

#2) route to see all communitiesss
@app.route('/api/communities', methods=['GET'])
# This makes sure only people who are logged in can ask for this information.
@login_required
def get_all_communities_api():
    try:
        # Step 1: Go to the database and find all communities.
        # `.sort('created_at', -1)` means "show the newest communities first".
        communities_cursor = db.communities.find().sort('created_at', -1)
        
        # We'll create an empty list to store the communities we find.
        communities_list = []
        
        # Step 2: Look at each community one by one from the database.
        for community in communities_cursor:
            # The database uses special IDs (like `ObjectId`), but web browsers
            # prefer simple text. So, we change the community's ID to a string.
            community['_id'] = str(community['_id'])
            
            # If the "created by" person's ID is also a special database ID,
            # we change that to a string too.
            if isinstance(community.get('created_by'), ObjectId):
                community['created_by'] = str(community['created_by'])
            
            # Dates from the database are special objects. We change them
            # into a standard text format that web browsers understand.
            if isinstance(community.get('created_at'), datetime):
                community['created_at'] = community['created_at'].isoformat()
            
            # The 'members' list in the database might have special IDs too.
            # We go through each member ID and turn it into a string.
            if 'members' in community and isinstance(community['members'], list):
                community['members'] = [str(member_id) if isinstance(member_id, ObjectId) else member_id for member_id in community['members']]
            else:
                # If a community has no 'members' list, we just make it an empty list.
                community['members'] = []

            # We also add a new piece of info: how many members the community has.
            # This makes it easier for your website to display this number.
            community['members_count'] = len(community.get('members', []))

            # If there's a picture for the community, we include its web address.
            community['community_picture_url'] = community.get('community_picture_url') 

            # Add this nicely prepared community information to our list.
            communities_list.append(community)
        
        # Just a message for you in your server's terminal, so you know it worked!
        print(f"Fetched {len(communities_list)} communities for API.")
        
        # Step 3: Send the list of communities back to the web browser.
        # `jsonify` turns your Python list into a format (JSON) that browsers can easily read.
        # `200` is a happy code meaning "everything went well!".
        return jsonify(communities_list), 200
    except Exception as e:
        # If something goes wrong while trying to get communities (e.g., database error),
        # we catch the problem here.
        print(f"Error fetching all communities API: {e}")
        # This helps you see the detailed error message in your server's terminal.
        import traceback
        traceback.print_exc() 
        # And we send an error message back to the browser.
        return jsonify({'success': False, 'message': 'An error occurred while fetching communities.'}), 500

#creating communities
@app.route('/api/communities', methods=['POST'])
@login_required # Ensure only logged-in users can create communities
def create_community_api():
    try:
        # Get data from the form submitted by the web browser
        community_name = request.form.get('name')
        community_description = request.form.get('description')
        community_picture = request.files.get('community_picture') # Get the uploaded file

        # Basic validation to make sure required fields are not empty
        if not community_name:
            return jsonify({'success': False, 'message': 'Community name is required.'}), 400

        # Prepare data for the database
        community_data = {
            'name': community_name,
            'description': community_description,
            'created_by': session['user']['_id'], # Store the ID of the user who created it
            'created_at': datetime.utcnow(), # Store the current time
            'members': [session['user']['_id']], # Creator is automatically the first member
            'community_picture_url': None # Default to None, update if a picture is uploaded
        }

        # Handle community picture upload
        if community_picture and allowed_file(community_picture.filename):
            # Create a unique filename to prevent overwrites
            filename = secure_filename(community_picture.filename)
            unique_filename = str(uuid.uuid4()) + '_' + filename
            filepath = os.path.join(app.config['COMMUNITY_UPLOAD_FOLDER'], unique_filename)
            community_picture.save(filepath) # Save the file to the server

            # Store the URL path to the image in the database
            community_data['community_picture_url'] = url_for('static', filename=f'uploads/community_pics/{unique_filename}')
        elif community_picture: # If a file was sent but not allowed
            return jsonify({'success': False, 'message': 'Invalid file type for community picture. Allowed types: png, jpg, jpeg, gif.'}), 400

        # Insert the new community data into the 'communities' collection in MongoDB
        result = db.communities.insert_one(community_data)
        
        # Check if the insertion was successful
        if result.inserted_id:
            print(f"Community '{community_name}' created successfully with ID: {result.inserted_id}")
            return jsonify({
                'success': True,
                'message': 'Community created successfully!',
                'community_id': str(result.inserted_id), # Return the new community's ID
                'community_picture_url': community_data['community_picture_url'] # Return the URL if uploaded
            }), 201 # 201 Created status code
        else:
            return jsonify({'success': False, 'message': 'Failed to create community in database.'}), 500

    except Exception as e:
        # If any error occurs, print it to the server console and send an error response
        print(f"Error creating community: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': 'An internal server error occurred.'}), 500


@app.route('/api/communities/<community_id>/join', methods=['POST'])
@login_required
def join_community(community_id):
    if 'user' not in session:
        return jsonify({'message': 'Unauthorized'}), 401

    user_id = session['user']['_id'] # Get the actual user ID from session

    try:
        community_oid = ObjectId(community_id)
        # Add the user to the community's members list
        result = db.communities.update_one(
            {'_id': community_oid, 'members': {'$ne': user_id}}, # Only add if not already a member
            {'$push': {'members': user_id}, '$inc': {'members_count': 1}}
        )
        if result.matched_count == 0:
            return jsonify({'message': 'Community not found or you are already a member.'}), 404
        if result.modified_count == 1:
            return jsonify({'message': 'Joined community successfully!'}), 200
        else:
            return jsonify({'message': 'Failed to join community.'}), 500
    except Exception as e:
        print(f"Error joining community: {e}")
        return jsonify({'message': 'An error occurred while joining the community.'}), 500

@app.route('/api/communities/<community_id>/leave', methods=['POST'])
@login_required
def leave_community(community_id):
    if 'user' not in session:
        return jsonify({'message': 'Unauthorized'}), 401

    user_id = session['user']['_id'] # Get the actual user ID from session

    try:
        community_oid = ObjectId(community_id)
        # Remove the user from the community's members list
        result = db.communities.update_one(
            {'_id': community_oid, 'members': user_id}, # Only remove if currently a member
            {'$pull': {'members': user_id}, '$inc': {'members_count': -1}}
        )
        if result.matched_count == 0:
            return jsonify({'message': 'Community not found or you are not a member.'}), 404
        if result.modified_count == 1:
            return jsonify({'message': 'Left community successfully!'}), 200
        else:
            return jsonify({'message': 'Failed to leave community.'}), 500
    except Exception as e:
        print(f"Error leaving community: {e}")
        return jsonify({'message': 'An error occurred while leaving the community.'}), 500


@app.route('/communities/<community_id>')
def community_view(community_id):
    try:
        community = db.communities.find_one({'_id': ObjectId(community_id)})
        if community:
            # Convert ObjectId to string for JSON serialization in the template if needed
            community['_id'] = str(community['_id'])
            # You might want to fetch posts related to this community here as well
            # For now, we'll just pass the community object
            return render_template('community_view.html', community=community)
        else:
            return "Community not found", 404
    except Exception as e:
        print(f"Error fetching community: {e}")
        return "Internal Server Error", 500


#to post in community
@app.route('/api/communities/<community_id>/posts', methods=['POST'])
def create_community_post(community_id):
    if 'user' not in session or not session['user'].get('_id'):
        return jsonify({'message': 'Unauthorized'}), 401

    if not ObjectId.is_valid(community_id):
        return jsonify({'message': 'Invalid Community ID'}), 400

    # Ensure the community exists
    community = db.communities.find_one({'_id': ObjectId(community_id)})
    if not community:
        return jsonify({'message': 'Community not found'}), 404

    # Check if the user is a member of the community
    if session['user']['_id'] not in community.get('members', []):
        return jsonify({'message': 'You must be a member to post in this community.'}), 403

    content = request.form.get('content')
    media_file = request.files.get('media')
    image_url = None

    if not content and not media_file:
        return jsonify({'message': 'Post content or media is required'}), 400

    if media_file and allowed_file(media_file.filename):
        filename = secure_filename(str(uuid.uuid4()) + '_' + media_file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        try:
            media_file.save(filepath)
            image_url = url_for('static', filename='uploads/posts/' + filename)
        except Exception as e:
            print(f"Error saving media file: {e}")
            return jsonify({'message': 'Failed to upload media file'}), 500
    elif media_file:
        return jsonify({'message': 'Invalid file type'}), 400

    try:
        post_document = {
            'author_id': ObjectId(session['user']['_id']),
            'community_id': community_id, # Store as string, convert when querying if needed
            'content': content,
            'media_url': image_url,
            'timestamp': datetime.utcnow(),
            'likes': [],
            'comments': []
        }
        inserted_post = db.posts.insert_one(post_document)
        print(f"Community post created successfully with ID: {inserted_post.inserted_id}")
        return jsonify({
            'message': 'Post created successfully',
            'post_id': str(inserted_post.inserted_id),
            'image_url': image_url
        }), 201
    except Exception as e:
        print(f"Error during database insertion for community post: {e}")
        return jsonify({'message': 'An error occurred during post creation'}), 500



#to get community posts
@app.route('/api/communities/<community_id>/posts', methods=['GET'])
def get_community_posts(community_id):
    try:
        if not ObjectId.is_valid(community_id):
            return jsonify({'message': 'Invalid Community ID format'}), 400

        community_obj_id = ObjectId(community_id)
        current_user_obj_id = ObjectId(session['user_id']) if 'user_id' in session else None

        community = db.communities.find_one({'_id': community_obj_id})
        if not community:
            return jsonify({'message': 'Community not found.'}), 404

        posts_cursor = db.posts.find({'community_id': community_id}).sort('timestamp', -1)

        posts_list = []
        for post in posts_cursor:
            processed_post = dict(post)

            # --- Fix: Convert community_id and original_post_id to strings ---
            if 'community_id' in processed_post and isinstance(processed_post['community_id'], ObjectId):
                processed_post['community_id'] = str(processed_post['community_id'])
            if 'original_post_id' in processed_post and isinstance(processed_post['original_post_id'], ObjectId):
                processed_post['original_post_id'] = str(processed_post['original_post_id'])

            processed_post['_id'] = str(processed_post['_id'])

            # Author handling
            author_id_str = str(processed_post.get('author_id'))
            if isinstance(processed_post.get('author_id'), ObjectId):
                processed_post['author_id'] = author_id_str

            author_details = {'username': 'Unknown User', 'profile_pic_url': '/static/default-profile.jpg'}
            try:
                author_doc = db.users.find_one({'_id': ObjectId(author_id_str)})
                if author_doc:
                    author_details['username'] = author_doc.get('username', 'Unknown User')
                    author_details['profile_pic_url'] = author_doc.get('profile_pic_url', '/static/default-profile.jpg')
            except Exception as e:
                print(f"Error fetching author data for {author_id_str}: {e}")

            processed_post['author_name'] = author_details['username']
            processed_post['profile_pic_url'] = author_details['profile_pic_url']

            # Timestamp
            if isinstance(processed_post.get('timestamp'), datetime):
                processed_post['timestamp'] = processed_post['timestamp'].isoformat() + 'Z'
            else:
                processed_post['timestamp'] = processed_post.get('timestamp', datetime.utcnow().isoformat() + 'Z')

            # Likes
            processed_post['likes'] = [str(uid) for uid in processed_post.get('likes', [])]
            processed_post['like_count'] = len(processed_post['likes'])
            processed_post['current_user_liked'] = current_user_obj_id and str(current_user_obj_id) in processed_post['likes']

            # Other fields
            processed_post['media_url'] = processed_post.get('media_url')
            processed_post['comments_count'] = processed_post.get('comments_count', 0)
            processed_post['repost_count'] = processed_post.get('repost_count', 0)

            # Handle reposts
            if processed_post.get('is_repost') and 'original_post_id' in processed_post:
                try:
                    original_post = db.posts.find_one({'_id': ObjectId(processed_post['original_post_id'])})
                    if original_post:
                        original_processed = dict(original_post)
                        original_processed['_id'] = str(original_processed['_id'])

                        if 'community_id' in original_processed and isinstance(original_processed['community_id'], ObjectId):
                            original_processed['community_id'] = str(original_processed['community_id'])
                        if 'original_post_id' in original_processed and isinstance(original_processed['original_post_id'], ObjectId):
                            original_processed['original_post_id'] = str(original_processed['original_post_id'])
                        if 'author_id' in original_processed and isinstance(original_processed['author_id'], ObjectId):
                            original_processed['author_id'] = str(original_processed['author_id'])

                        original_author_id_str = str(original_processed.get('author_id'))
                        original_author = {'username': 'Unknown User', 'profile_pic_url': '/static/default-profile.jpg'}
                        try:
                            author_doc = db.users.find_one({'_id': ObjectId(original_author_id_str)})
                            if author_doc:
                                original_author['username'] = author_doc.get('username', 'Unknown User')
                                original_author['profile_pic_url'] = author_doc.get('profile_pic_url', '/static/default-profile.jpg')
                        except Exception as e:
                            print(f"Error fetching original author data: {e}")

                        original_processed['author_name'] = original_author['username']
                        original_processed['profile_pic_url'] = original_author['profile_pic_url']

                        if isinstance(original_processed.get('timestamp'), datetime):
                            original_processed['timestamp'] = original_processed['timestamp'].isoformat() + 'Z'
                        else:
                            original_processed['timestamp'] = original_processed.get('timestamp', datetime.utcnow().isoformat() + 'Z')

                        original_processed['likes'] = [str(uid) for uid in original_processed.get('likes', [])]
                        original_processed['like_count'] = len(original_processed['likes'])
                        original_processed['current_user_liked'] = current_user_obj_id and str(current_user_obj_id) in original_processed['likes']

                        original_processed['comments_count'] = original_processed.get('comments_count', 0)
                        original_processed['repost_count'] = original_processed.get('repost_count', 0)
                        original_processed['media_url'] = original_processed.get('media_url')

                        processed_post['original_post_details'] = original_processed
                    else:
                        processed_post['original_post_details'] = None
                except Exception as e:
                    print(f"Error handling repost: {e}")
                    processed_post['original_post_details'] = None

            posts_list.append(processed_post)

        return jsonify({'posts': posts_list}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'message': f'Internal server error while fetching community posts: {e}'}), 500


#liking post and unliking post 
@app.route('/api/posts/<post_id>/toggle_like', methods=['POST'])
def toggle_like_post(post_id):
    try:
        # Ensure user is logged in
        if 'user_id' not in session:
            return jsonify({'message': 'Unauthorized'}), 401

        # Validate post ID
        if not ObjectId.is_valid(post_id):
            return jsonify({'message': 'Invalid Post ID'}), 400

        user_obj_id = ObjectId(session['user_id'])
        post_obj_id = ObjectId(post_id)

        # Find the post
        post = db.posts.find_one({'_id': post_obj_id})
        if not post:
            return jsonify({'message': 'Post not found'}), 404

        # Check if user already liked the post
        # Ensure 'likes' field exists and is a list; convert any ObjectIds to strings for comparison
        likes = [str(uid) for uid in post.get('likes', []) if ObjectId.is_valid(uid) or isinstance(uid, str)]
        
        # User's ID as a string for comparison
        user_id_str = str(user_obj_id)

        if user_id_str in likes:
            # User has liked it, so unlike
            db.posts.update_one(
                {'_id': post_obj_id},
                {'$pull': {'likes': user_obj_id}} # Pull the ObjectId from the array
            )
            liked = False
            message = 'Post unliked successfully'
        else:
            # User has not liked it, so like
            db.posts.update_one(
                {'_id': post_obj_id},
                {'$push': {'likes': user_obj_id}} # Push the ObjectId to the array
            )
            liked = True
            message = 'Post liked successfully'
        
        # Get the updated post to send back the new like count and status
        updated_post = db.posts.find_one({'_id': post_obj_id})
        updated_like_count = len(updated_post.get('likes', []))

        return jsonify({
            'message': message,
            'liked': liked,
            'like_count': updated_like_count
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'message': f'Error toggling like: {e}'}), 500








@app.route('/logout', methods=['POST'])
def logout():
    session.pop('user_id', None) # Clears the old user ID if it exists
    session.pop('user', None)    # ***ADD THIS LINE*** to clear the 'user' dictionary
    return jsonify({'message': 'Logged out successfully', 'redirect': url_for('login_page')}), 200

# Profile routes
@app.route('/profile/<username>', methods=['GET'])
@login_required # Require login to view profiles
def user_profile(username):
    # Find the user by username
    user_data = db.users.find_one({'username': username})

    if not user_data:
        # If user is not found, render profile.html with user_found=False
        return render_template('profile.html', user_found=False, username=username)

    # Convert ObjectId and datetime objects for the profile data
    display_user_data = dict(user_data)
    display_user_data['_id'] = str(display_user_data['_id']) # Convert user's _id

    # Ensure profile_pic_url fallback
    if 'profile_pic_url' not in display_user_data or not display_user_data['profile_pic_url']:
        display_user_data['profile_pic_url'] = url_for('static', filename='default-profile.jpg')

    # Ensure other fields have defaults if missing (for safer template rendering)
    display_user_data['bio'] = display_user_data.get('bio', 'No bio available.')
    display_user_data['course'] = display_user_data.get('course', 'Not specified.')
    display_user_data['email'] = display_user_data.get('email', 'N/A')
    display_user_data['registration_date'] = display_user_data.get('registration_date', datetime.utcnow()).strftime('%Y-%m-%d')


    # Determine if the currently logged-in user is viewing their own profile
    is_current_user_profile = False
    current_session_user_id = session.get('user_id')
    if current_session_user_id:
        try:
            if ObjectId(current_session_user_id) == user_data['_id']:
                is_current_user_profile = True
        except Exception as e: # Catch specific exception for invalid ObjectId
            print(f"Error converting session user ID to ObjectId: {e}")
            pass # Invalid ObjectId in session, treat as not current user (or log for debugging)

    return render_template(
        'profile.html', 
        user=display_user_data, 
        user_found=True,
        is_current_user_profile=is_current_user_profile # Pass this to HTML for conditional rendering
    )

# Route for events
@app.route('/events', methods=['GET'])
def events():
    return render_template('events.html')

@app.route('/api/events', methods=['GET', 'POST'])
def handle_events_api():
    """
    Handles API requests for events:
    - GET: Fetches a list of events.
    - POST: Creates a new event.
    """
    if request.method == 'GET':
        # Your existing GET logic for events
        try:
            events_cursor = db.events.find().sort([('date', 1), ('time', 1)])

            events_list = []
            for event in events_cursor:
                event['_id'] = str(event['_id'])
                if isinstance(event.get('date'), datetime):
                    event['date'] = event['date'].isoformat()
                # Ensure participants_count is present for existing events as well when fetching
                event['participants_count'] = event.get('participants_count', 0) 
                events_list.append(event)
            
            return jsonify(events_list), 200

        except Exception as e:
            print(f"Error fetching events: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'message': 'Failed to fetch events'}), 500

    elif request.method == 'POST':
        try:
            event_data = request.get_json()

            # Basic validation
            required_fields = ['title', 'date', 'time', 'location']
            if not all(field in event_data for field in required_fields):
                return jsonify({'message': 'Missing required event fields'}), 400

            # Convert date string to datetime object for better database management
            try:
                event_data['date'] = datetime.strptime(event_data['date'], '%Y-%m-%d')
            except ValueError:
                return jsonify({'message': 'Invalid date format. Use YYYY-MM-DD.'}), 400

            # Add a timestamp for creation
            event_data['created_at'] = datetime.utcnow()
            
            # --- IMPORTANT ADDITION: Initialize participants_count ---
            event_data['participants_count'] = 0 
            # --- END IMPORTANT ADDITION ---

            # You might want to add author_id from session here
            # event_data['author_id'] = session.get('user_id')

            # Insert into MongoDB
            result = db.events.insert_one(event_data)

            # Return the created event's ID
            return jsonify({'message': 'Event created successfully', 'event_id': str(result.inserted_id)}), 201

        except Exception as e:
            print(f"Error creating event: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({'message': 'Failed to create event'}), 500
        





@app.route('/api/events/<event_id>/join', methods=['POST'])
def api_join_event(event_id):
    """
    Handles a user joining an event.
    Increments participants_count and adds user_id to participants array.
    """
    # In a real application, you'd get the user_id from the session after authentication
    # For now, let's use 'anonymous' as the dummy user_id for demonstration purposes if no user is logged in.
    # This ensures consistency with the frontend's default for currentUserId.
    user_id = session.get('user_id', 'anonymous') 
    
    # If the user_id is explicitly 'anonymous' (meaning not logged in), require authentication
    if user_id == 'anonymous': 
        return jsonify({'message': 'Authentication required to join event'}), 401
    
    # Optional: If your user_id in MongoDB is ObjectId, ensure consistency.
    # For simplicity, assuming user_id can be a string for $addToSet
    
    try:
        # Convert event_id string from URL to ObjectId for MongoDB query
        event_obj_id = ObjectId(event_id)
    except Exception:
        return jsonify({'message': 'Invalid Event ID format'}), 400

    try:
        # Atomically update the event:
        # Find the event by _id AND ensure the user is NOT already in the 'participants' array.
        # This prevents incrementing count and adding duplicates if the user clicks multiple times.
        result = db.events.update_one(
            {'_id': event_obj_id, 'participants': {'$ne': user_id}}, 
            {
                '$inc': {'participants_count': 1}, # Increment count
                '$addToSet': {'participants': user_id} # Add user ID to set (only if not present)
            }
        )

        if result.matched_count == 0:
            # If matched_count is 0, it means either:
            # 1. The event_id was not found.
            # 2. The user_id was already in the 'participants' array (due to '$ne': user_id in query).
            
            # Check if the event exists to differentiate the case
            event_exists = db.events.find_one({'_id': event_obj_id})
            if not event_exists:
                return jsonify({'message': 'Event not found'}), 404
            elif user_id in event_exists.get('participants', []):
                # If event exists and user is already a participant
                return jsonify({'message': 'You have already joined this event'}), 409 # Conflict status code
            else:
                # Should not be reached with the $ne query condition, but good for debugging
                return jsonify({'message': 'No changes were made (e.g., event not found or user already joined)'}), 200 # Consider a more specific code if needed
        
        # If modified_count is 1, it means the update (increment and addToSet) was successful.
        if result.modified_count == 1:
            return jsonify({'message': 'Successfully joined event', 'event_id': event_id, 'user_id': user_id}), 200
        else:
            # This case means matched_count was > 0, but modified_count was 0.
            # This is generally covered by the 'already joined' check above,
            # but serves as a final fallback for no actual change.
            return jsonify({'message': 'Could not join event, no change occurred (e.g., user already joined)'}), 200

    except Exception as e:
        print(f"Error joining event {event_id}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Failed to join event due to server error'}), 500


    
# Route for settings
PROFILE_PICS_UPLOAD_FOLDER = os.path.join(app.root_path, 'static', 'profile_pics')
if not os.path.exists(PROFILE_PICS_UPLOAD_FOLDER):
    os.makedirs(PROFILE_PICS_UPLOAD_FOLDER)

# --- Unified Settings Route (GET and POST) ---
@app.route('/settings', methods=['GET', 'POST'])
@login_required # Ensure user is logged in to access their settings
def settings():
    user_id = session.get('user_id')

    # This check is largely redundant with @login_required but harmless
    if not user_id:
        return redirect(url_for('login_page')) # Redirect to your login page

    try:
        user_obj_id = ObjectId(user_id)
        current_user = db.users.find_one({'_id': user_obj_id})

        if not current_user:
            session.pop('user_id', None)
            session.pop('user', None)
            # Return an error JSON for POST, or redirect for GET
            if request.method == 'POST':
                return jsonify({"message": "User not found. Please log in again.", "type": "error"}), 401
            return redirect(url_for('login_page'))


        # Prepare user data for the template, ensuring ObjectId/datetime are handled
        display_user_data = dict(current_user)
        display_user_data['_id'] = str(display_user_data['_id']) # Convert ObjectId to string

        # Ensure 'last_username_change_date' is a datetime object for JS, or None/string
        if 'last_username_change_date' in display_user_data and isinstance(display_user_data['last_username_change_date'], str):
            try:
                display_user_data['last_username_change_date'] = datetime.fromisoformat(display_user_data['last_username_change_date'])
            except ValueError:
                display_user_data['last_username_change_date'] = None
        elif 'last_username_change_date' not in display_user_data:
            display_user_data['last_username_change_date'] = None
        
        # Provide default profile picture URL if not set
        if 'profile_pic_url' not in display_user_data or not display_user_data['profile_pic_url']:
            display_user_data['profile_pic_url'] = url_for('static', filename='default-profile.jpg')


        if request.method == 'POST':
            response_messages = [] # Collect messages to return in JSON
            
            # --- Handle Profile Picture Upload ---
            if 'profile_picture' in request.files:
                file = request.files['profile_picture']
                if file.filename == '':
                    # No file selected, ignore this field
                    pass
                elif file and allowed_file(file.filename): # Use your existing allowed_file function
                    unique_filename = str(uuid.uuid4()) + '_' + secure_filename(file.filename)
                    file_path = os.path.join(PROFILE_PICS_UPLOAD_FOLDER, unique_filename)
                    file.save(file_path)
                    
                    display_user_data['profile_pic_url'] = url_for('static', filename=f'profile_pics/{unique_filename}')
                    db.users.update_one({'_id': user_obj_id}, {'$set': {'profile_pic_url': display_user_data['profile_pic_url']}})
                    response_messages.append({"message": "Profile picture updated!", "type": "success"})
                else:
                    response_messages.append({"message": "Invalid file type for profile picture. Allowed types: png, jpg, jpeg, gif.", "type": "warning"})
            
            # --- Handle Other Profile Field Updates (username, email, bio, course) ---
            username = request.form.get('username')
            email = request.form.get('email')
            bio = request.form.get('bio')
            course = request.form.get('course')

            update_data = {}
            updated_username_date = None 

            # Username update logic (with 30-day cooldown)
            if username and username != current_user.get('username'):
                last_change_date = display_user_data.get('last_username_change_date')
                if last_change_date:
                    time_since_last_change = datetime.utcnow() - last_change_date
                    if time_since_last_change < timedelta(days=30): 
                        response_messages.append({"message": f"Username can only be changed every 30 days. Next change available after {(last_change_date + timedelta(days=30)).strftime('%Y-%m-%d')}.", "type": "danger"})
                    else:
                        if db.users.find_one({'username': username, '_id': {'$ne': user_obj_id}}):
                            response_messages.append({"message": "Username already taken. Please choose another.", "type": "danger"})
                        else:
                            update_data['username'] = username
                            update_data['last_username_change_date'] = datetime.utcnow()
                            updated_username_date = update_data['last_username_change_date'].isoformat()
                            response_messages.append({"message": "Username updated!", "type": "success"})
                else: # First time changing username
                    if db.users.find_one({'username': username, '_id': {'$ne': user_obj_id}}):
                        response_messages.append({"message": "Username already taken. Please choose another.", "type": "danger"})
                    else:
                        update_data['username'] = username
                        update_data['last_username_change_date'] = datetime.utcnow()
                        updated_username_date = update_data['last_username_change_date'].isoformat()
                        response_messages.append({"message": "Username updated!", "type": "success"})


            # Email update logic
            if email and email != current_user.get('email'):
                if db.users.find_one({'email': email, '_id': {'$ne': user_obj_id}}):
                    response_messages.append({"message": "Email already registered. Please choose another.", "type": "danger"})
                else:
                    update_data['email'] = email
                    response_messages.append({"message": "Email updated!", "type": "success"})

            # Bio update logic
            if 'bio' in request.form and bio != current_user.get('bio', ''): # Check if field was submitted and value changed
                update_data['bio'] = bio
                response_messages.append({"message": "Bio updated!", "type": "success"})
            elif 'bio' not in request.form and 'bio' in current_user and current_user['bio'] != '': # If bio was removed from form but existed before and wasn't empty
                update_data['bio'] = ''
                response_messages.append({"message": "Bio cleared!", "type": "success"})

            # Course update logic
            if course and course != current_user.get('course', ''):
                update_data['course'] = course
                response_messages.append({"message": "Course updated!", "type": "success"})
            

            if update_data:
                db.users.update_one({'_id': user_obj_id}, {'$set': update_data})
                # Re-fetch user to update session and pass to template on re-render
                current_user = db.users.find_one({'_id': user_obj_id}) 
                session['user'] = { # Update session with latest user data
                    '_id': str(current_user['_id']),
                    'username': current_user.get('username'),
                    'profile_pic_url': current_user.get('profile_pic_url', url_for('static', filename='default-profile.jpg')),
                    'email': current_user.get('email'),
                    'bio': current_user.get('bio', ''),
                    'course': current_user.get('course', '')
                }

            # Determine overall success/error for the HTTP status code
            # If any 'danger' message exists, return 400, else 200
            status_code = 200
            for msg in response_messages:
                if msg['type'] == 'danger':
                    status_code = 400
                    break
            
            # If no changes were made and no specific messages, provide a general info message
            if not update_data and not response_messages:
                response_messages.append({"message": "No changes detected.", "type": "info"})
                status_code = 200

            # Return JSON response to frontend
            return jsonify({
                "messages": response_messages, # List of message objects
                "updated_username_date": updated_username_date, # For JS to update cooldown
                "profile_pic_url": display_user_data['profile_pic_url'] # To update preview/nav pic
            }), status_code

        # GET request: Render the settings page with current user data
        if 'last_username_change_date' in display_user_data and isinstance(display_user_data['last_username_change_date'], datetime):
            display_user_data['last_username_change_date'] = display_user_data['last_username_change_date'].isoformat()
        else:
            display_user_data['last_username_change_date'] = '' 

        return render_template('settings.html', user=display_user_data)

    except Exception as e:
        print(f"Error in settings route: {e}") # Keep print for server-side logging
        # Return a generic error JSON for frontend
        if request.method == 'POST':
            return jsonify({"message": "An unexpected server error occurred.", "type": "error"}), 500
        return redirect(url_for('home')) # Redirect for GET requests on error

# --- Post API Endpoints ---
@app.route('/api/posts', methods=['POST'])
@login_required
def create_post():
    print("----- Create Post Attempt -----")
    user_id = session.get('user_id')
    if not user_id:
        print("Error: User not logged in, but @login_required should handle this.")
        return jsonify({'message': 'User not authenticated'}), 401

    content = request.form.get('content')
    image_file = request.files.get('image')

    post_type = 'text'
    image_url = None

    if image_file and allowed_file(image_file.filename):
        try:
            filename = secure_filename(image_file.filename)
            unique_filename = f"{user_id}_{datetime.utcnow().timestamp()}_{filename}"
            image_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            image_file.save(image_path)
            image_url = f"/{UPLOAD_FOLDER}/{unique_filename}"
            post_type = 'image'
            print(f"Image saved: {image_url}")
        except Exception as e:
            print(f"Error saving image file: {e}")
            return jsonify({'message': 'Failed to upload image', 'error': str(e)}), 500
    elif image_file:
        print(f"File type not allowed: {image_file.filename}")
        return jsonify({'message': 'Invalid file type for image upload'}), 400

    if not content and not image_url:
        print("Error: Post content and image are both empty.")
        return jsonify({'message': 'Post content or an image is required'}), 400

    user = db.users.find_one({'_id': ObjectId(user_id)}, {'username': 1, 'name': 1, 'profile_pic_url': 1})
    if not user:
        print(f"Error: User with ID {user_id} not found.")
        return jsonify({'message': 'Author not found'}), 404

    username = user.get('username')
    author_name = user.get('name', username)
    profile_pic_url = user.get('profile_pic_url', '')

    post_document = {
        'author_id': user_id,
        'username': username,
        'author_name': author_name,
        'profile_pic_url': profile_pic_url,
        'content': content,
        'type': post_type,
        'timestamp': datetime.utcnow(),
        'likes': [],
        'comments': []
    }

    if image_url:
        post_document['image_url'] = image_url

    try:
        inserted_post = db.posts.insert_one(post_document)
        print(f"Post created successfully with ID: {inserted_post.inserted_id}")
        return jsonify({
            'message': 'Post created successfully',
            'post_id': str(inserted_post.inserted_id),
            'image_url': image_url
        }), 201
    except Exception as e:
        print(f"Error during database insertion for post: {e}")
        return jsonify({'message': 'An error occurred during post creation'}), 500
    
#delete post @app.route('/api/posts/<post_id>/delete', methods=['DELETE'])
@login_required # Only logged-in users can attempt to delete posts
def delete_post(post_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Unauthorized: Please log in."}), 401

    try:
        post_obj_id = ObjectId(post_id)
        current_user_obj_id = ObjectId(user_id)

        # Find the post to verify ownership
        post = db.posts.find_one({'_id': post_obj_id})

        if not post:
            return jsonify({"message": "Post not found."}), 404

        # Authorization check: Only the author of the post can delete it.
        # Assuming 'author_id' in your post document is an ObjectId
        if post.get('author_id') != current_user_obj_id:
            return jsonify({"message": "Forbidden: You are not authorized to delete this post."}), 403

        # If authorized, proceed to delete the post
        # IMPORTANT: Also delete associated comments/replies and potentially likes/reposts if they are separate documents
        db.posts.delete_one({'_id': post_obj_id})
        
        # Optional: Delete all comments/replies associated with this post
        db.comments.delete_many({'post_id': post_obj_id})
        
        # Optional: If likes/reposts are stored in separate collections with a post_id reference, delete them too
        # db.likes.delete_many({'post_id': post_obj_id})
        # db.reposts.delete_many({'original_post_id': post_obj_id}) # If reposts are separate documents referencing original post

        return jsonify({"message": "Post deleted successfully.", "post_id": post_id}), 200

    except Exception as e:
        print(f"Error deleting post {post_id}: {e}")
        # Return a generic error to the frontend
        return jsonify({"message": "An error occurred while deleting the post."}), 500


# Route for fetching posts (GENERAL FEED)
# Route for fetching posts (GENERAL FEED)
@app.route('/api/posts', methods=['GET'])
def get_posts():
    print("----- Fetch All Posts Attempt (Public Posts Only) -----")
    try:
        current_user_obj_id = None
        if 'user_id' in session:
            try:
                current_user_obj_id = ObjectId(session['user_id'])
            except Exception as e:
                print(f"Warning: Invalid user_id in session: {e}. Cannot determine user-specific likes/reposts.")
                current_user_obj_id = None

        posts_cursor = db.posts.find({
            '$or': [
                {'community_id': {'$exists': False}},
                {'community_id': None}
            ]
        }).sort('timestamp', -1)

        posts_list = []

        for post in posts_cursor:
            post['_id'] = str(post['_id'])

            if isinstance(post.get('author_id'), ObjectId):
                post['author_id'] = str(post['author_id'])
            elif 'author_id' in post:
                post['author_id'] = str(post['author_id'])
            else:
                post['author_id'] = 'unknown'

            if 'timestamp' in post and isinstance(post['timestamp'], datetime):
                post['timestamp'] = post['timestamp'].isoformat() + 'Z'
            else:
                post['timestamp'] = datetime.utcnow().isoformat() + 'Z'

            if 'community_id' in post and isinstance(post['community_id'], ObjectId):
                post['community_id'] = str(post['community_id'])

            likes_list_ids = post.get('likes', [])
            post['likes'] = [str(like_id) if isinstance(like_id, ObjectId) else like_id for like_id in likes_list_ids]
            post['like_count'] = len(post['likes'])

            post['current_user_liked'] = current_user_obj_id and str(current_user_obj_id) in post['likes']

            # Recalculate repost_count based on actual repost documents
            post['repost_count'] = db.posts.count_documents({'original_post_id': ObjectId(post['_id'])})

            try:
                post_id_for_comments_count = ObjectId(post['_id'])
                # Assuming comments are in a separate 'comments' collection and linked by 'post_id'
                post['comments_count'] = db.comments.count_documents({'post_id': post_id_for_comments_count})
            except Exception as e:
                print(f"Error counting comments for post {post['_id']}: {e}")
                post['comments_count'] = 0

            try:
                author_id_obj = ObjectId(post['author_id'])
                author_info = db.users.find_one(
                    {'_id': author_id_obj},
                    {'username': 1, 'name': 1, 'profile_pic_url': 1} # Fetch both username and name
                )
            except Exception as e:
                print(f"Error fetching author info for post {post['_id']}: {e}")
                author_info = None

            if author_info:
                author_info['_id'] = str(author_info['_id'])
                # FIX HERE: Explicitly use username for author_name
                post['username'] = author_info.get('username')
                post['author_name'] = author_info.get('username', 'Unknown User') # Use username as primary
                post['profile_pic_url'] = author_info.get('profile_pic_url', url_for('static', filename='default-profile.jpg'))
            else:
                post['username'] = 'Unknown User'
                post['author_name'] = 'Unknown User'
                post['profile_pic_url'] = url_for('static', filename='default-profile.jpg')

            post['is_repost'] = post.get('is_repost', False)

            if post['is_repost']:
                original_post_id_obj = post.get('original_post_id')
                if isinstance(original_post_id_obj, ObjectId):
                    post['original_post_id'] = str(original_post_id_obj)
                    original_details = db.posts.find_one({'_id': original_post_id_obj})

                    if original_details:
                        original_details['_id'] = str(original_details['_id'])

                        if isinstance(original_details.get('author_id'), ObjectId):
                            original_details['author_id'] = str(original_details['author_id'])
                        elif 'author_id' in original_details:
                            original_details['author_id'] = str(original_details['author_id'])

                        if 'timestamp' in original_details and isinstance(original_details['timestamp'], datetime):
                            original_details['timestamp'] = original_details['timestamp'].isoformat() + 'Z'
                        else:
                            original_details['timestamp'] = datetime.utcnow().isoformat() + 'Z'

                        try:
                            original_author_id_obj = ObjectId(original_details['author_id'])
                            original_author_info = db.users.find_one(
                                {'_id': original_author_id_obj},
                                {'username': 1, 'name': 1, 'profile_pic_url': 1}
                            )
                        except Exception as e:
                            print(f"Error fetching original author info for original post {original_details['_id']}: {e}")
                            original_author_info = None

                        if original_author_info:
                            original_author_info['_id'] = str(original_author_info['_id'])
                            # FIX HERE: Explicitly use username for original_author_name
                            original_details['author_name'] = original_author_info.get('username', 'Unknown User') # Use username as primary
                            original_details['profile_pic_url'] = original_author_info.get('profile_pic_url', url_for('static', filename='default-profile.jpg'))
                        else:
                            original_details['author_name'] = 'Unknown User'
                            original_details['profile_pic_url'] = url_for('static', filename='default-profile.jpg')

                        original_details_likes = original_details.get('likes', [])
                        original_details['likes'] = [str(like_id) if isinstance(like_id, ObjectId) else like_id for like_id in original_details_likes]
                        original_details['like_count'] = len(original_details['likes'])
                        original_details['current_user_liked'] = current_user_obj_id and str(current_user_obj_id) in original_details['likes']

                        original_details['repost_count'] = db.posts.count_documents({'original_post_id': ObjectId(original_details['_id'])})
                        try:
                            original_post_id_for_comments_count = ObjectId(original_details['_id'])
                            original_details['comments_count'] = db.comments.count_documents({'post_id': original_post_id_for_comments_count})
                        except Exception as e:
                            print(f"Error counting comments for original post {original_details['_id']}: {e}")
                            original_details['comments_count'] = 0

                        post['original_post_details'] = original_details
                    else:
                        post['original_post_details'] = None
                else:
                    post['original_post_id'] = None
                    post['original_post_details'] = None

            posts_list.append(post)

        print(f"Fetched {len(posts_list)} posts.")
        return jsonify(posts_list), 200

    except Exception as e:
        print(f"Error fetching posts: {e}")
        return jsonify({'message': f'Internal server error while fetching posts: {e}'}), 500
    
def is_logged_in():
    return 'user_id' in session and session['user_id'] is not None

@app.route('/api/posts/<post_id>/like', methods=['POST'])
def like_post(post_id):
    if not is_logged_in():
        return jsonify({'message': 'Unauthorized. Please log in.'}), 401

    user_id = session['user_id'] # Get the ObjectId of the current user
    # Convert user_id from string to ObjectId for database query
    try:
        user_obj_id = ObjectId(user_id)
        post_obj_id = ObjectId(post_id)
    except Exception:
        return jsonify({'message': 'Invalid Post ID or User ID format.'}), 400

    try:
        # Check if the post exists
        post = db.posts.find_one({'_id': post_obj_id})
        if not post:
            return jsonify({'message': 'Post not found.'}), 404

        # Check if the user has already liked the post
        if user_obj_id in post.get('likes', []):
            return jsonify({'message': 'Post already liked by this user.'}), 409 # Conflict

        # Add user_id to the likes array
        db.posts.update_one(
            {'_id': post_obj_id},
            {
                '$addToSet': {'likes': user_obj_id}, # $addToSet prevents duplicates
                '$inc': {'like_count': 1} # Optional: Maintain a separate like_count
            }
        )
        return jsonify({'message': 'Post liked successfully!', 'liked': True}), 200

    except Exception as e:
        print(f"Error liking post: {e}")
        return jsonify({'message': f'Internal server error: {e}'}), 500


# Route for Unliking a Post
@app.route('/api/posts/<post_id>/unlike', methods=['POST'])
def unlike_post(post_id):
    if not is_logged_in():
        return jsonify({'message': 'Unauthorized. Please log in.'}), 401

    user_id = session['user_id'] # Get the ObjectId of the current user
    # Convert user_id from string to ObjectId for database query
    try:
        user_obj_id = ObjectId(user_id)
        post_obj_id = ObjectId(post_id)
    except Exception:
        return jsonify({'message': 'Invalid Post ID or User ID format.'}), 400

    try:
        # Check if the post exists
        post = db.posts.find_one({'_id': post_obj_id})
        if not post:
            return jsonify({'message': 'Post not found.'}), 404

        # Check if the user has indeed liked the post
        if user_obj_id not in post.get('likes', []):
            return jsonify({'message': 'Post not liked by this user.'}), 409 # Conflict

        # Remove user_id from the likes array
        db.posts.update_one(
            {'_id': post_obj_id},
            {
                '$pull': {'likes': user_obj_id},
                '$inc': {'like_count': -1} # Optional: Decrement like_count
            }
        )
        return jsonify({'message': 'Post unliked successfully!', 'unliked': True}), 200

    except Exception as e:
        print(f"Error unliking post: {e}")
        return jsonify({'message': f'Internal server error: {e}'}), 500
    
#route for viewing comment page 
@app.route('/post/<post_id>/details', methods=['GET'])
def post_details_page(post_id):
    if 'user_id' not in session:
        return redirect(url_for('login_page')) 

    try:
        ObjectId(post_id)
    except Exception:
        return "Invalid Post ID format.", 400

    return render_template('comments.html', post_id=post_id)


@app.route('/api/posts/<post_id>', methods=['GET'])
def get_single_post_details(post_id):
    print(f"--- API Call: get_single_post_details for post_id: {post_id} ---")

    current_user_obj_id = None
    if 'user_id' in session and session['user_id']:
        try:
            current_user_obj_id = ObjectId(session['user_id'])
        except Exception as e:
            print(f"Warning: Invalid user_id format in session '{session['user_id']}': {e}. Removing from session.")
            session.pop('user_id', None)
            current_user_obj_id = None

   

    try:
        post_obj_id = ObjectId(post_id)
    except Exception as e:
        print(f"Invalid Post ID format in API call: {e}")
        return jsonify({'message': 'Invalid Post ID format'}), 400

    try:
        post = db.posts.find_one({'_id': post_obj_id})
        if not post:
            print(f"Post {post_id} not found in DB.")
            return jsonify({'message': 'Post not found'}), 404

        post_data_for_json = {}
        for key, value in post.items():
            if isinstance(value, ObjectId):
                post_data_for_json[key] = str(value)
            elif isinstance(value, datetime):
                post_data_for_json[key] = value.isoformat() + 'Z'
            elif key == 'likes' and isinstance(value, list):
                post_data_for_json[key] = [str(uid) for uid in value if isinstance(uid, ObjectId)]
            else:
                post_data_for_json[key] = value

        if '_id' in post_data_for_json:
            post_data_for_json['_id'] = str(post_data_for_json['_id'])
        if 'author_id' in post_data_for_json:
            post_data_for_json['author_id'] = str(post_data_for_json['author_id'])
        else:
            post_data_for_json['author_id'] = 'unknown'

        # Reposting Logic: UPDATED PART FOR REPOST COUNT
        post_data_for_json['is_repost'] = post.get('is_repost', False)
        # Calculate repost_count for the main post being viewed
        post_data_for_json['repost_count'] = db.posts.count_documents({'original_post_id': post_obj_id})

        if post_data_for_json['is_repost']:
            original_post_id_obj = post.get('original_post_id')
            if isinstance(original_post_id_obj, ObjectId):
                post_data_for_json['original_post_id'] = str(original_post_id_obj)
                original_details = db.posts.find_one({'_id': original_post_id_obj})
                if original_details:
                    original_details_for_json = {}
                    for key, value in original_details.items():
                        if isinstance(value, ObjectId):
                            original_details_for_json[key] = str(value)
                        elif isinstance(value, datetime):
                            original_details_for_json[key] = value.isoformat() + 'Z'
                        elif key == 'likes' and isinstance(value, list):
                            original_details_for_json[key] = [str(uid) for uid in value if isinstance(uid, ObjectId)]
                        else:
                            original_details_for_json[key] = value

                    # Process original post author info
                    original_author_info = None
                    original_details_for_json['author_id'] = str(original_details.get('author_id', 'unknown'))

                    if ObjectId.is_valid(original_details_for_json['author_id']):
                        try:
                            original_author_info = db.users.find_one(
                                {'_id': ObjectId(original_details_for_json['author_id'])},
                                {'username': 1, 'name': 1, 'profile_pic_url': 1}
                            )
                        except Exception as e:
                            print(f"Error fetching original author info for original post {original_details_for_json.get('_id', 'N/A')} with ID '{original_details_for_json['author_id']}': {e}")

                    if original_author_info:
                        original_details_for_json['author_name'] = original_author_info.get('username', original_author_info.get('username', 'Unknown User'))
                        original_details_for_json['profile_pic_url'] = original_author_info.get('profile_pic_url', url_for('static', filename='default-profile.jpg'))
                    else:
                        original_details_for_json['author_name'] = 'Unknown User'
                        original_details_for_json['profile_pic_url'] = url_for('static', filename='default-profile.jpg')

                    # Check if current user liked the original post
                    original_likes_as_objectids = [uid for uid in original_details.get('likes', []) if isinstance(uid, ObjectId)]
                    original_details_for_json['current_user_liked'] = current_user_obj_id in original_likes_as_objectids
                    original_details_for_json['like_count'] = len(original_likes_as_objectids)
                    # Calculate repost_count for the ORIGINAL post (not just getting it from the document)
                    original_details_for_json['repost_count'] = db.posts.count_documents({'original_post_id': ObjectId(original_details_for_json['_id'])})


                    post_data_for_json['original_post_details'] = original_details_for_json
                else:
                    post_data_for_json['original_post_details'] = None # Original post not found (e.g., deleted)
            else:
                post_data_for_json['original_post_id'] = None # Invalid original_post_id in DB
                post_data_for_json['original_post_details'] = None # No original details to fetch

        # If it's an original post (not a repost), handle its own author details
        # If it's a repost, the author_name and profile_pic_url of post_data_for_json
        # should refer to the reposter.
        if not post_data_for_json['is_repost']:
            author_info = None
            if ObjectId.is_valid(post_data_for_json['author_id']):
                try:
                    author_info = db.users.find_one(
                        {'_id': ObjectId(post_data_for_json['author_id'])},
                        {'username': 1, 'name': 1, 'profile_pic_url': 1}
                    )
                except Exception as e:
                    print(f"Error fetching author info for main post {post_data_for_json['_id']} with ID '{post_data_for_json['author_id']}': {e}")

            if author_info:
                post_data_for_json['author_name'] = author_info.get('name', author_info.get('username', 'Unknown User'))
                post_data_for_json['profile_pic_url'] = author_info.get('profile_pic_url', url_for('static', filename='default-profile.jpg'))
            else:
                post_data_for_json['author_name'] = 'Unknown User'
                post_data_for_json['profile_pic_url'] = url_for('static', filename='default-profile.jpg')
        else:
            # If it's a repost, the 'author_name' and 'profile_pic_url' fields
            # will refer to the *reposter*, not the original author.
            reposter_info = None
            if ObjectId.is_valid(post_data_for_json['author_id']): # This is the reposter's ID
                try:
                    reposter_info = db.users.find_one(
                        {'_id': ObjectId(post_data_for_json['author_id'])},
                        {'username': 1, 'name': 1, 'profile_pic_url': 1}
                    )
                except Exception as e:
                    print(f"Error fetching reposter info for post {post_data_for_json['_id']} with ID '{post_data_for_json['author_id']}': {e}")
            if reposter_info:
                post_data_for_json['author_name'] = reposter_info.get('name', reposter_info.get('username', 'Unknown User'))
                post_data_for_json['profile_pic_url'] = reposter_info.get('profile_pic_url', url_for('static', filename='default-profile.jpg'))
            else:
                post_data_for_json['author_name'] = 'Unknown User' # The reposter is unknown
                post_data_for_json['profile_pic_url'] = url_for('static', filename='default-profile.jpg')


        # Prepare for current_user_liked check for the current post
        current_post_likes_as_objectids = [uid for uid in post.get('likes', []) if isinstance(uid, ObjectId)]
        post_data_for_json['current_user_liked'] = current_user_obj_id in current_post_likes_as_objectids
        post_data_for_json['like_count'] = len(current_post_likes_as_objectids)


        # --- FETCH AND PROCESS COMMENTS (unchanged from your last version) ---
        comments_cursor = db.comments.find({'post_id': post_obj_id}).sort('timestamp', 1)
        comments_list_for_json = []
        for comment in comments_cursor:
            comment_data_for_json = {}
            for key, value in comment.items():
                if isinstance(value, ObjectId):
                    comment_data_for_json[key] = str(value)
                elif isinstance(value, datetime):
                    comment_data_for_json[key] = value.isoformat() + 'Z'
                elif key == 'likes' and isinstance(value, list):
                    comment_data_for_json[key] = [str(uid) for uid in value if isinstance(uid, ObjectId)]
                else:
                    comment_data_for_json[key] = value

            if '_id' in comment_data_for_json:
                comment_data_for_json['_id'] = str(comment_data_for_json['_id'])
            if 'post_id' in comment_data_for_json:
                comment_data_for_json['post_id'] = str(comment_data_for_json['post_id'])

            if 'author_id' in comment_data_for_json:
                comment_data_for_json['author_id'] = str(comment_data_for_json['author_id'])
            else:
                comment_data_for_json['author_id'] = 'unknown'

            comment_author_id_obj = None
            if ObjectId.is_valid(comment_data_for_json['author_id']):
                try:
                    comment_author_id_obj = ObjectId(comment_data_for_json['author_id'])
                except Exception as e:
                    print(f"Warning: Could not convert comment author_id '{comment_data_for_json['author_id']}' to ObjectId during lookup: {e}")

            comment_author_info = None
            if comment_author_id_obj:
                try:
                    comment_author_info = db.users.find_one(
                        {'_id': comment_author_id_obj},
                        {'username': 1, 'name': 1, 'profile_pic_url': 1}
                    )
                except Exception as e:
                    print(f"Error fetching comment author info for comment {comment_data_for_json['_id']} with ID '{comment_data_for_json['author_id']}': {e}")

            if comment_author_info:
                comment_data_for_json['author_name'] = comment_author_info.get('name', comment_author_info.get('username', 'Unknown User'))
                comment_data_for_json['author_profile_pic_url'] = comment_author_info.get('profile_pic_url', url_for('static', filename='default-profile.jpg'))
            else:
                comment_data_for_json['author_name'] = 'Unknown User'
                comment_data_for_json['author_profile_pic_url'] = url_for('static', filename='default-profile.jpg')

            comment_likes_as_objectids = [uid for uid in comment.get('likes', []) if isinstance(uid, ObjectId)]
            comment_data_for_json['current_user_liked'] = current_user_obj_id in comment_likes_as_objectids
            comment_data_for_json['like_count'] = len(comment_likes_as_objectids)

            # --- FETCH AND PROCESS REPLIES (unchanged from your last version) ---
            replies_cursor = db.replies.find({'comment_id': comment['_id']}).sort('timestamp', 1)
            replies_list_for_json = []
            for reply in replies_cursor:
                reply_data_for_json = {}
                for key, value in reply.items():
                    if isinstance(value, ObjectId):
                        reply_data_for_json[key] = str(value)
                    elif isinstance(value, datetime):
                        reply_data_for_json[key] = value.isoformat() + 'Z'
                    elif key == 'likes' and isinstance(value, list):
                        reply_data_for_json[key] = [str(uid) for uid in value if isinstance(uid, ObjectId)]
                    else:
                        reply_data_for_json[key] = value

                if '_id' in reply_data_for_json:
                    reply_data_for_json['_id'] = str(reply_data_for_json['_id'])
                if 'comment_id' in reply_data_for_json:
                    reply_data_for_json['comment_id'] = str(reply_data_for_json['comment_id'])
                if 'author_id' in reply_data_for_json:
                    reply_data_for_json['author_id'] = str(reply_data_for_json['author_id'])
                else:
                    reply_data_for_json['author_id'] = 'unknown'

                reply_author_id_obj = None
                if ObjectId.is_valid(reply_data_for_json['author_id']):
                    try:
                        reply_author_id_obj = ObjectId(reply_data_for_json['author_id'])
                    except Exception as e:
                        print(f"Warning: Could not convert reply author_id '{reply_data_for_json['author_id']}' to ObjectId during lookup: {e}")

                reply_author_info = None
                if reply_author_id_obj:
                    try:
                        reply_author_info = db.users.find_one(
                            {'_id': reply_author_id_obj},
                            {'username': 1, 'name': 1, 'profile_pic_url': 1}
                        )
                    except Exception as e:
                        print(f"Error fetching reply author info for reply {reply_data_for_json['_id']} with ID '{reply_data_for_json['author_id']}': {e}")

                if reply_author_info:
                    reply_data_for_json['author_name'] = reply_author_info.get('name', reply_author_info.get('username', 'Unknown User'))
                    reply_data_for_json['author_profile_pic_url'] = reply_author_info.get('profile_pic_url', url_for('static', filename='default-profile.jpg'))
                else:
                    reply_data_for_json['author_name'] = 'Unknown User'
                    reply_data_for_json['author_profile_pic_url'] = url_for('static', filename='default-profile.jpg')

                reply_likes_as_objectids = [uid for uid in reply.get('likes', []) if isinstance(uid, ObjectId)]
                reply_data_for_json['current_user_liked'] = current_user_obj_id in reply_likes_as_objectids
                reply_data_for_json['like_count'] = len(reply_likes_as_objectids)

                replies_list_for_json.append(reply_data_for_json)
            comment_data_for_json['replies'] = replies_list_for_json

            comments_list_for_json.append(comment_data_for_json)

        current_user_profile_pic = url_for('static', filename='default-profile.jpg')
        if current_user_obj_id:
            current_user_doc = db.users.find_one(
                {'_id': current_user_obj_id},
                {'profile_pic_url': 1}
            )
            if current_user_doc:
                current_user_profile_pic = current_user_doc.get('profile_pic_url', url_for('static', filename='default-profile.jpg'))


        return jsonify({
            'post': post_data_for_json,
            'comments': comments_list_for_json,
            'current_user_profile_pic': current_user_profile_pic
        }), 200

    except Exception as e:
        print(f"An unexpected error occurred in get_single_post_details: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': f'Internal server error: {e}'}), 500
    
@app.route('/api/posts/<post_id>/comments', methods=['POST'])
def add_comment(post_id):
    if 'user_id' not in session:
        print("DEBUG: Unauthorized access attempt for add_comment.")
        return jsonify({'message': 'Unauthorized'}), 401
    current_user_id = session['user_id']
    data = request.get_json()
    content = data.get('content')

    if not content:
        print("DEBUG: Comment content is missing.")
        return jsonify({'message': 'Comment content is required'}), 400

    try:
        print(f"DEBUG: add_comment received post_id string: {post_id}")
        post_obj_id = ObjectId(post_id)
        print(f"DEBUG: add_comment converted post_id to ObjectId: {post_obj_id}")

        # Ensure post exists
        found_post = db.posts.find_one({'_id': post_obj_id})
        print(f"DEBUG: db.posts.find_one result for {post_obj_id}: {found_post}")

        if not found_post:
            print(f"DEBUG: Post with ID {post_id} NOT found in database.")
            return jsonify({'message': 'Post not found'}), 404

        new_comment = {
            'post_id': post_obj_id,
            'author_id': ObjectId(current_user_id),
            'content': content,
            'timestamp': datetime.now(),
            'likes': []
        }
        result = db.comments.insert_one(new_comment)
        print(f"DEBUG: Comment added successfully with ID: {result.inserted_id}")

      
        db.posts.update_one(
            {'_id': post_obj_id},
            {'$inc': {'comments_count': 1}}
        )
        print(f"DEBUG: comments_count incremented for post {post_obj_id}")
        

        return jsonify({'message': 'Comment added', 'comment_id': str(result.inserted_id)}), 201

    except Exception as e:
        print(f"DEBUG: Error adding comment: {e}")
        import traceback
        traceback.print_exc() # Helps to see the full error in your console
        return jsonify({'message': f'Internal server error: {e}'}), 500





@app.route('/api/comments/<comment_id>/replies', methods=['POST'])
def add_reply(comment_id):
    if 'user_id' not in session:
        return jsonify({'message': 'Unauthorized'}), 401
    current_user_id = session['user_id']
    data = request.get_json()
    content = data.get('content')

    if not content:
        return jsonify({'message': 'Reply content is required'}), 400

    try:
        comment_obj_id = ObjectId(comment_id)
        # Ensure comment exists
        if not db.comments.find_one({'_id': comment_obj_id}):
            return jsonify({'message': 'Comment not found'}), 404

        new_reply = {
            'comment_id': comment_obj_id,
            'author_id': ObjectId(current_user_id),
            'content': content,
            'timestamp': datetime.now(),
            'likes': []
        }
        result = db.replies.insert_one(new_reply)
        return jsonify({'message': 'Reply added', 'reply_id': str(result.inserted_id)}), 201

    except Exception as e:
        print(f"Error adding reply: {e}")
        return jsonify({'message': f'Internal server error: {e}'}), 500


@app.route('/api/comments/<comment_id>/<action>', methods=['POST'])
def like_comment(comment_id, action):
    if 'user_id' not in session:
        return jsonify({'message': 'Unauthorized'}), 401
    current_user_obj_id = ObjectId(session['user_id'])

    try:
        comment_obj_id = ObjectId(comment_id)
    except:
        return jsonify({'message': 'Invalid Comment ID'}), 400

    if action not in ['like', 'unlike']:
        return jsonify({'message': 'Invalid action'}), 400

    try:
        if action == 'like':
            result = db.comments.update_one(
                {'_id': comment_obj_id},
                {'$addToSet': {'likes': current_user_obj_id}}
            )
            if result.modified_count > 0:
                return jsonify({'message': 'Comment liked', 'liked': True}), 200
            else:
                return jsonify({'message': 'Comment already liked', 'liked': True}), 200
        else: # action == 'unlike'
            result = db.comments.update_one(
                {'_id': comment_obj_id},
                {'$pull': {'likes': current_user_obj_id}}
            )
            if result.modified_count > 0:
                return jsonify({'message': 'Comment unliked', 'unliked': True}), 200
            else:
                return jsonify({'message': 'Comment not liked by user', 'unliked': True}), 200
    except Exception as e:
        print(f"Error liking/unliking comment: {e}")
        return jsonify({'message': f'Internal server error: {e}'}), 500


@app.route('/api/replies/<reply_id>/<action>', methods=['POST'])
def like_reply(reply_id, action):
    if 'user_id' not in session:
        return jsonify({'message': 'Unauthorized'}), 401
    current_user_obj_id = ObjectId(session['user_id'])

    try:
        reply_obj_id = ObjectId(reply_id)
    except:
        return jsonify({'message': 'Invalid Reply ID'}), 400

    if action not in ['like', 'unlike']:
        return jsonify({'message': 'Invalid action'}), 400

    try:
        if action == 'like':
            result = db.replies.update_one(
                {'_id': reply_obj_id},
                {'$addToSet': {'likes': current_user_obj_id}}
            )
            if result.modified_count > 0:
                return jsonify({'message': 'Reply liked', 'liked': True}), 200
            else:
                return jsonify({'message': 'Reply already liked', 'liked': True}), 200
        else: # action == 'unlike'
            result = db.replies.update_one(
                {'_id': reply_obj_id},
                {'$pull': {'likes': current_user_obj_id}}
            )
            if result.modified_count > 0:
                return jsonify({'message': 'Reply unliked', 'unliked': True}), 200
            else:
                return jsonify({'message': 'Reply not liked by user', 'unliked': True}), 200
    except Exception as e:
        print(f"Error liking/unliking reply: {e}")
        return jsonify({'message': f'Internal server error: {e}'}), 500
    



#reposting
@app.route('/api/posts/<post_id>/repost', methods=['POST'])
def repost_post(post_id):
    """
    Handles the reposting of an existing post. Creates a new post document
    flagged as a repost and increments the original post's repost count.
    """
    print(f"--- API Call: repost_post for original_post_id: {post_id} ---")

    # 1. Authentication and User ID Validation
    if 'user_id' not in session or not session['user_id']:
        print("DEBUG: Unauthorized access attempt for repost_post: User ID missing from session.")
        return jsonify({'message': 'Unauthorized'}), 401

    current_user_obj_id = None
    try:
        current_user_obj_id = ObjectId(session['user_id'])
    except Exception as e:
        print(f"DEBUG: Invalid user_id in session for reposting: {session['user_id']} - {e}")
        session.pop('user_id', None) # Clear invalid session ID
        return jsonify({'message': 'Invalid user session. Please log in again.'}), 401

    # 2. Validate Original Post ID format
    try:
        original_post_obj_id = ObjectId(post_id)
    except Exception as e:
        print(f"DEBUG: Invalid Original Post ID format for repost: {post_id} - {e}")
        return jsonify({'message': 'Invalid Post ID format'}), 400

    try:
        # 3. Check if the original post exists in the database
        original_post = db.posts.find_one({'_id': original_post_obj_id})
        if not original_post:
            print(f"DEBUG: Original post with ID {post_id} not found for repost.")
            return jsonify({'message': 'Original post not found'}), 404

        # --- FIX: Get the community_id from the original post (it can be None) ---
        original_community_id = original_post.get('community_id')
        # If original_community_id is None, it means it's a public post.
        # We no longer return 400 here; the repost will simply not have a community_id.
        print(f"DEBUG: Original post {post_id} community_id: {original_community_id} (None implies public).")
        # --- END FIX ---

        # 4. Prevent a user from reposting the same post multiple times (optional but recommended)
        existing_repost = db.posts.find_one({
            'original_post_id': original_post_obj_id,
            'author_id': current_user_obj_id,
            'is_repost': True
        })
        if existing_repost:
            print(f"DEBUG: User {current_user_obj_id} has already reposted post {original_post_obj_id}.")
            return jsonify({'message': 'You have already reposted this post.'}), 409 # 409 Conflict

        # 5. Get optional quote content from the request body (for quote reposts)
        data = request.get_json()
        quote_content = data.get('content', '').strip()

        # 6. Create the new repost document
        new_repost_document = {
            'author_id': current_user_obj_id,
            'original_post_id': original_post_obj_id,
            'is_repost': True,
            'timestamp': datetime.now(),
            'content': quote_content,
            'likes': [],
            'repost_count': 0,
            'comments_count': 0,
            'community_id': original_community_id # Assign the fetched community_id (can be None)
        }

        insert_result = db.posts.insert_one(new_repost_document)
        new_repost_id = insert_result.inserted_id
        print(f"DEBUG: Repost created with ID: {new_repost_id} by user {current_user_obj_id}.")

        # 7. Increment the `repost_count` on the ORIGINAL post
        db.posts.update_one(
            {'_id': original_post_obj_id},
            {'$inc': {'repost_count': 1}}
        )
        print(f"DEBUG: Incremented repost_count for original post {original_post_obj_id}.")

        # 8. Return success response
        return jsonify({
            'message': 'Post reposted successfully',
            'repost_id': str(new_repost_id),
            'original_post_id': str(original_post_obj_id)
        }), 201

    except Exception as e:
        print(f"An unexpected error occurred during reposting: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': f'Internal server error: {e}'}), 500
    

@app.route('/trending')
@admin_required
def trending_dashboard_page():
    return render_template('trending.html')



@app.route('/api/trending/total_posts')
@admin_required
def api_total_posts():
    """
    Counts total posts only on the public homepage feed.
    Excludes posts with a community_id.
    """
    try:
        total_posts = db.posts.count_documents({
            '$or': [
                {'community_id': {'$exists': False}}, # No community_id field
                {'community_id': None}               # community_id field exists but is null
            ]
        })
        return jsonify({'total_posts': total_posts})
    except Exception as e:
        print(f"Error fetching total public posts: {e}")
        return jsonify({'message': 'Error fetching total public posts'}), 500

@app.route('/api/trending/total_likes')
@admin_required
def api_total_likes():
    """
    Counts total likes across all public posts.
    """
    try:
        # First, get IDs of public posts
        public_post_ids = [
            str(p['_id']) for p in db.posts.find(
                {'$or': [{'community_id': {'$exists': False}}, {'community_id': None}]},
                {'_id': 1} # Project only _id
            )
        ]
        
        # Then, sum likes only from those public posts
        pipeline = [
            {'$match': {'_id': {'$in': [ObjectId(pid) for pid in public_post_ids]}}},
            {'$group': {'_id': None, 'total_likes': {'$sum': '$like_count'}}}
        ]
        result = list(db.posts.aggregate(pipeline))
        total_likes = result[0]['total_likes'] if result else 0
        return jsonify({'total_likes': total_likes})
    except Exception as e:
        print(f"Error fetching total public likes: {e}")
        return jsonify({'message': 'Error fetching total public likes'}), 500

@app.route('/api/trending/total_reposts')
@admin_required
def api_total_reposts():
    """
    Counts total reposts that appear on the public homepage feed.
    This means counting documents where 'is_repost' is True AND the repost itself is public.
    """
    try:
        total_reposts = db.posts.count_documents({
            'is_repost': True,
            '$or': [
                {'community_id': {'$exists': False}}, # Repost is public
                {'community_id': None}                # Repost is public
            ]
        })
        return jsonify({'total_reposts': total_reposts})
    except Exception as e:
        print(f"Error fetching total public reposts: {e}")
        return jsonify({'message': 'Error fetching total public reposts'}), 500

@app.route('/api/trending/total_comments')
@admin_required
def api_total_comments():
    """
    Counts total top-level comments on posts that appear on the public homepage feed.
    Excludes replies and comments on community posts.
    """
    try:
        # Step 1: Get the ObjectIds of all public posts (on homepage)
        public_post_ids = [
            p['_id'] for p in db.posts.find(
                {'$or': [{'community_id': {'$exists': False}}, {'community_id': None}]},
                {'_id': 1} # Project only _id
            )
        ]
        
        # Step 2: Count comments that belong to these public posts AND are top-level comments (not replies)
        total_comments = db.comments.count_documents({
            'post_id': {'$in': public_post_ids},
            '$or': [
                {'parent_comment_id': {'$exists': False}}, # No parent_comment_id field (top-level)
                {'parent_comment_id': None}               # parent_comment_id is null (top-level)
            ]
        })
        return jsonify({'total_comments': total_comments})
    except Exception as e:
        print(f"Error fetching total public comments: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Error fetching total public comments'}), 500

@app.route('/api/trending/total_users')
@admin_required
def api_total_users():
    """
    Counts the total number of users.
    """
    try:
        total_users = db.users.count_documents({}) # Count all documents in the users collection
        return jsonify({'total_users': total_users})
    except Exception as e:
        print(f"Error fetching total users: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Error fetching total users'}), 500

@app.route('/api/trending/total_communities')
@admin_required
def api_total_communities():
    """
    Counts the total number of communities.
    """
    try:
        total_communities = db.communities.count_documents({}) # Count all documents in the communities collection
        return jsonify({'total_communities': total_communities})
    except Exception as e:
        print(f"Error fetching total communities: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Error fetching total communities'}), 500

@app.route('/api/trending/total_events')
@admin_required
def api_total_events():
    """
    Counts the total number of events.
    """
    try:
        total_events = db.events.count_documents({}) # Count all documents in the events collection
        return jsonify({'total_events': total_events})
    except Exception as e:
        print(f"Error fetching total events: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Error fetching total events'}), 500

@app.route('/trending/total_users')
@admin_required
def total_users_page():
    """Renders the page to display total users."""
    return render_template('total-users.html')

@app.route('/trending/total_communities')
@admin_required
def total_communities_page():
    """Renders the page to display total communities."""
    return render_template('total-communities.html')

@app.route('/trending/total_events')
@admin_required
def total_events_page():
    """Renders the page to display total events."""
    return render_template('total-events.html')


@app.route('/api/trending/most_liked_posts')
@admin_required
def api_most_liked_posts():
    """
    Fetches most liked public posts.
    """
    try:
        current_user_obj_id = session.get('user_id') 
        if current_user_obj_id:
            try:
                current_user_obj_id = ObjectId(current_user_obj_id)
            except:
                current_user_obj_id = None 

        limit = request.args.get('limit', type=int)
        
        posts_query = db.posts.find(
            {'$or': [{'community_id': {'$exists': False}}, {'community_id': None}]} # Only public posts
        ).sort('like_count', -1)

        if limit is not None:
            posts_query = posts_query.limit(limit)

        most_liked_posts = []
        for post_doc in posts_query:
            # Inlined serialization
            processed_post = dict(post_doc)
            processed_post['_id'] = str(processed_post['_id'])
            
            # Convert ObjectIds to strings
            for key in ['community_id', 'original_post_id', 'author_id']:
                if key in processed_post and isinstance(processed_post[key], ObjectId):
                    processed_post[key] = str(processed_post[key])

            # Inlined author details fetching
            author_id_str = processed_post.get('author_id')
            author_details = {'username': 'Unknown User', 'profile_pic_url': url_for('static', filename='default-profile.jpg')}
            if author_id_str:
                try:
                    author_doc = db.users.find_one({'_id': ObjectId(author_id_str)})
                    if author_doc:
                        author_details['username'] = author_doc.get('username', 'Unknown User')
                        author_details['profile_pic_url'] = author_doc.get('profile_pic_url', url_for('static', filename='default-profile.jpg'))
                except Exception as e:
                    print(f"Error fetching author data for {author_id_str}: {e}")

            processed_post['author_name'] = author_details['username']
            processed_post['profile_pic_url'] = author_details['profile_pic_url']

            if isinstance(processed_post.get('timestamp'), datetime):
                processed_post['timestamp'] = processed_post['timestamp'].isoformat() + 'Z'

            processed_post['likes'] = [str(uid) for uid in processed_post.get('likes', []) if ObjectId.is_valid(uid) or isinstance(uid, str)]
            processed_post['like_count'] = len(processed_post['likes'])
            processed_post['current_user_liked'] = current_user_obj_id is not None and str(current_user_obj_id) in processed_post['likes']

            processed_post['media_url'] = processed_post.get('media_url')
            processed_post['comments_count'] = processed_post.get('comments_count', 0)
            processed_post['repost_count'] = processed_post.get('repost_count', 0)

            processed_post['original_post_details'] = None # No recursive for trending list to simplify

            if 'likes' in processed_post:
                del processed_post['likes']
            most_liked_posts.append(processed_post)

        return jsonify(most_liked_posts)
    except Exception as e:
        print(f"Error fetching most liked public posts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Error fetching most liked public posts'}), 500

@app.route('/api/trending/most_reposted_posts')
@admin_required
def api_most_reposted_posts():
    """
    Fetches most reposted public posts.
    """
    try:
        current_user_obj_id = session.get('user_id') 
        if current_user_obj_id:
            try:
                current_user_obj_id = ObjectId(current_user_obj_id)
            except:
                current_user_obj_id = None 

        limit = request.args.get('limit', type=int)

        posts_query = db.posts.find(
            {'$or': [{'community_id': {'$exists': False}}, {'community_id': None}]} # Only public posts
        ).sort('repost_count', -1)

        if limit is not None:
            posts_query = posts_query.limit(limit)

        most_reposted_posts = []
        for post_doc in posts_query:
            # Inlined serialization
            processed_post = dict(post_doc)
            processed_post['_id'] = str(processed_post['_id'])
            
            for key in ['community_id', 'original_post_id', 'author_id']:
                if key in processed_post and isinstance(processed_post[key], ObjectId):
                    processed_post[key] = str(processed_post[key])

            # Inlined author details fetching
            author_id_str = processed_post.get('author_id')
            author_details = {'username': 'Unknown User', 'profile_pic_url': url_for('static', filename='default-profile.jpg')}
            if author_id_str:
                try:
                    author_doc = db.users.find_one({'_id': ObjectId(author_id_str)})
                    if author_doc:
                        author_details['username'] = author_doc.get('username', 'Unknown User')
                        author_details['profile_pic_url'] = author_doc.get('profile_pic_url', url_for('static', filename='default-profile.jpg'))
                except Exception as e:
                    print(f"Error fetching author data for {author_id_str}: {e}")

            processed_post['author_name'] = author_details['username']
            processed_post['profile_pic_url'] = author_details['profile_pic_url']

            if isinstance(processed_post.get('timestamp'), datetime):
                processed_post['timestamp'] = processed_post['timestamp'].isoformat() + 'Z'

            processed_post['likes'] = [str(uid) for uid in processed_post.get('likes', []) if ObjectId.is_valid(uid) or isinstance(uid, str)]
            processed_post['like_count'] = len(processed_post['likes'])
            processed_post['current_user_liked'] = current_user_obj_id is not None and str(current_user_obj_id) in processed_post['likes']

            processed_post['media_url'] = processed_post.get('media_url')
            processed_post['comments_count'] = processed_post.get('comments_count', 0)
            processed_post['repost_count'] = processed_post.get('repost_count', 0)

            processed_post['original_post_details'] = None # No recursive for trending list to simplify

            if 'likes' in processed_post:
                del processed_post['likes']
            most_reposted_posts.append(processed_post)

        return jsonify(most_reposted_posts)
    except Exception as e:
        print(f"Error fetching most reposted public posts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Error fetching most reposted public posts'}), 500

@app.route('/api/trending/most_commented_posts')
@admin_required
def api_most_commented_posts():
    """
    Fetches most commented public posts (top-level comments only for counting).
    """
    try:
        current_user_obj_id = session.get('user_id') 
        if current_user_obj_id:
            try:
                current_user_obj_id = ObjectId(current_user_obj_id)
            except:
                current_user_obj_id = None 

        limit = request.args.get('limit', type=int)

        posts_query = db.posts.find(
            {'$or': [{'community_id': {'$exists': False}}, {'community_id': None}]} # Only public posts
        ).sort('comments_count', -1) # Note: comments_count here refers to field on post, not re-calculated

        if limit is not None:
            posts_query = posts_query.limit(limit)

        most_commented_posts = []
        for post_doc in posts_query:
            # Inlined serialization
            processed_post = dict(post_doc)
            processed_post['_id'] = str(processed_post['_id'])
            
            for key in ['community_id', 'original_post_id', 'author_id']:
                if key in processed_post and isinstance(processed_post[key], ObjectId):
                    processed_post[key] = str(processed_post[key])

            # Inlined author details fetching
            author_id_str = processed_post.get('author_id')
            author_details = {'username': 'Unknown User', 'profile_pic_url': url_for('static', filename='default-profile.jpg')}
            if author_id_str:
                try:
                    author_doc = db.users.find_one({'_id': ObjectId(author_id_str)})
                    if author_doc:
                        author_details['username'] = author_doc.get('username', 'Unknown User')
                        author_details['profile_pic_url'] = author_doc.get('profile_pic_url', url_for('static', filename='default-profile.jpg'))
                except Exception as e:
                    print(f"Error fetching author data for {author_id_str}: {e}")

            processed_post['author_name'] = author_details['username']
            processed_post['profile_pic_url'] = author_details['profile_pic_url']

            if isinstance(processed_post.get('timestamp'), datetime):
                processed_post['timestamp'] = processed_post['timestamp'].isoformat() + 'Z'

            processed_post['likes'] = [str(uid) for uid in processed_post.get('likes', []) if ObjectId.is_valid(uid) or isinstance(uid, str)]
            processed_post['like_count'] = len(processed_post['likes'])
            processed_post['current_user_liked'] = current_user_obj_id is not None and str(current_user_obj_id) in processed_post['likes']

            processed_post['media_url'] = processed_post.get('media_url')
            processed_post['comments_count'] = db.comments.count_documents({ # Recalculate for trending list
                'post_id': ObjectId(processed_post['_id']),
                '$or': [{'parent_comment_id': {'$exists': False}}, {'parent_comment_id': None}]
            })
            processed_post['repost_count'] = processed_post.get('repost_count', 0)

            processed_post['original_post_details'] = None # No recursive for trending list to simplify

            if 'likes' in processed_post:
                del processed_post['likes']
            most_commented_posts.append(processed_post)

        return jsonify(most_commented_posts)
    except Exception as e:
        print(f"Error fetching most commented public posts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'Error fetching most commented public posts'}), 500




# ------------------- Individual Report Page Routes (updated for most_commented_posts) -------------------
@app.route('/trending/total_posts')
@admin_required
def total_posts_page():
    return render_template('total-posts.html')

@app.route('/trending/total_likes')
@admin_required
def total_likes_page():
    return render_template('total-likes.html')

@app.route('/trending/total_hashtags')
@admin_required
def total_hashtags_page():
    # This route is still here if you have a separate "Total Hashtags" page
    return render_template('total-hashtags.html')

@app.route('/trending/total_reposts')
@admin_required
def total_reposts_page():
    return render_template('total-reposts.html')

@app.route('/trending/total_comments') # New page route for Total Comments
@admin_required
def total_comments_page():
    return render_template('total-comments.html')

@app.route('/trending/most_liked_posts')
@admin_required
def most_liked_posts_page():
    return render_template('most-likes.html')

@app.route('/trending/most_commented_posts')
@admin_required
def most_commented_posts_page():
    return render_template('most-comments.html')

@app.route('/trending/most_reposted_posts')
@admin_required
def most_reposted_posts_page():
    return render_template('most-reposts.html')

#forgot password 
@app.route('/forgot_password_request', methods=['GET'])
def forgot_password_request_page():
    """Serves the page to request a password reset link."""
    return render_template('forgot_password_request.html')

@app.route('/api/request_password_reset', methods=['POST'])
def api_request_password_reset():
    """
    Handles the request to send a password reset email.
    Generates a token, stores it in DB, and sends a mock email.
    """
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({'success': False, 'message': 'Email is required.'}), 400

    user = db.users.find_one({'email': email})
    if not user:
        # For security, always respond as if the email was sent, even if user not found.
        # This prevents enumeration of valid user emails.
        print(f"Password reset requested for non-existent email: {email}") # Log it for debugging
        return jsonify({'success': True, 'message': 'If an account with that email exists, a password reset link has been sent.'}), 200

    # Generate a unique, secure, and time-limited token
    token = secrets.token_urlsafe(32) # Generates a random URL-safe text string
    expires_at = datetime.utcnow() + timedelta(hours=1) # Token valid for 1 hour

    # Store the token (or its hash) and expiry in the user's document
    # Store token directly for simple validation on reset (needs to be unique)
    db.users.update_one(
        {'_id': user['_id']},
        {'$set': {'reset_token': token, 'reset_token_expires_at': expires_at}}
    )

    # Construct the reset link
    reset_link = url_for('reset_password_token', token=token, _external=True)

    # Send the mock email
    send_password_reset_email_mock(user['email'], reset_link)

    return jsonify({'success': True, 'message': 'If an account with that email exists, a password reset link has been sent.'}), 200

@app.route('/reset_password/<token>', methods=['GET', 'POST'])
def reset_password_token(token):
    user = db.users.find_one({'reset_token': token})

    if not user:
        # If token is invalid or user not found with that token
        return render_template('message.html', message='Invalid or expired password reset link.', type='error'), 400

    # Check token expiry - This logic should apply to both GET and POST attempts
    if user.get('reset_token_expires_at') and user['reset_token_expires_at'] < datetime.utcnow():
        # Token expired, clear it from the database
        db.users.update_one({'_id': user['_id']}, {'$unset': {'reset_token': '', 'reset_token_expires_at': ''}})
        return render_template('message.html', message='Password reset link has expired. Please request a new one.', type='error'), 400

    # Handle GET request (display the form)
    if request.method == 'GET':
        # Render the form to set a new password, passing the token so JS can use it
        return render_template('reset_password.html', token=token)

    # Handle POST request (process the new password)
    elif request.method == 'POST':
        data = request.get_json()
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')

        # Input validation
        if not new_password or not confirm_password:
            return jsonify({'success': False, 'message': 'All fields are required.'}), 400
        if new_password != confirm_password:
            return jsonify({'success': False, 'message': 'Passwords do not match.'}), 400
        if len(new_password) < 6: # Ensure password meets minimum length
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters long.'}), 400

        # Hash the new password using bcrypt
        # It's crucial to encode the password to bytes and then decode the hash back to string for storage
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # Update password in the database and invalidate the reset token
        db.users.update_one(
            {'_id': user['_id']},
            {
                '$set': {'password': hashed_password},
                # Invalidate token by unsetting it after successful reset
                '$unset': {'reset_token': '', 'reset_token_expires_at': ''} 
            }
        )

        return jsonify({'success': True, 'message': 'Your password has been successfully reset. You can now log in with your new password.', 'redirect_url': url_for('login_page')}), 200

@app.route('/api/users')
def api_get_all_users():
    """
    Fetches all registered users from the MongoDB 'users' collection
    and returns them as a JSON array string.
    """
    try:
        all_users_cursor = db.users.find({})

        users_list = []
        for user in all_users_cursor:
            # Create a dictionary to hold the serializable user data
            serializable_user = {}
            for key, value in user.items():
                if key == '_id':
                    serializable_user[key] = str(value) # Convert ObjectId to string
                elif isinstance(value, datetime):
                    # Convert datetime objects to string format
                    serializable_user[key] = value.strftime('%Y-%m-%d %H:%M:%S')
                else:
                    serializable_user[key] = value # Keep other data as is

            # Ensure 'username' and 'email' fields are present in the serializable_user,
            # providing 'N/A' if missing, before appending.
            serializable_user['username'] = serializable_user.get('username', 'N/A')
            serializable_user['email'] = serializable_user.get('email', 'N/A')
            if 'registration_date' not in serializable_user:
                serializable_user['registration_date'] = 'N/A' # Add if not already set by datetime conversion

            users_list.append(serializable_user)

        # Manually convert the list of dictionaries to a JSON string.
        json_output = json.dumps(users_list)

        # Return the JSON string. Important: Set the mimetype to 'application/json'
        # so the browser (and JavaScript) knows it's receiving JSON data.
        return json_output, 200, {'Content-Type': 'application/json'}

    except Exception as e:
        print(f"Error fetching users for API (manual JSON): {e}")
        # For error, still return JSON with a proper status code
        error_response = json.dumps({"error": "Could not retrieve users", "message": str(e)})
        return error_response, 500, {'Content-Type': 'application/json'}



@app.route('/api/users/<username>/posts', methods=['GET'])
@login_required # Protect this endpoint
def api_user_posts(username):
    user_id_in_session = session.get('user_id') # Current logged-in user's ID
    current_user_obj_id = ObjectId(user_id_in_session) if user_id_in_session else None

    # First, find the user whose profile we are viewing
    profile_user = db.users.find_one({'username': username})
    if not profile_user:
        return jsonify({"message": "User not found."}), 404

    profile_user_id = profile_user['_id'] # This is the ObjectId of the user whose posts we want

    posts_list = []
    try:
        # Define the query filter:
        # 1. Posts by this specific author
        # 2. Posts that are "public" (do not have a community_id, or it's null, or it's an empty string)
        query_filter = {
            'author_id': profile_user_id,
            '$or': [ # Use $or to check for all cases of "public" posts
                {'community_id': {'$exists': False}}, # Case 1: community_id field does not exist
                {'community_id': None},               # Case 2: community_id field exists but is null
                {'community_id': ""}                  # Case 3: community_id field exists and is an empty string
            ]
        }

        # Fetch posts based on the filter, ordered by timestamp descending (newest first)
        posts_cursor = db.posts.find(query_filter).sort('timestamp', -1)

        for post_doc in posts_cursor:
            processed_post = dict(post_doc) # Create a mutable copy

            # Convert ObjectId and datetime objects to strings for JSON serialization
            processed_post['_id'] = str(processed_post['_id'])
            if 'original_post_id' in processed_post and isinstance(processed_post['original_post_id'], ObjectId):
                processed_post['original_post_id'] = str(processed_post['original_post_id'])
            
            # Convert community_id to string if it's an ObjectId and present
            if 'community_id' in processed_post and isinstance(processed_post['community_id'], ObjectId):
                processed_post['community_id'] = str(processed_post['community_id'])
            # If community_id is None or "", it stays as is or becomes null/empty string in JSON.

            if isinstance(processed_post.get('timestamp'), datetime):
                processed_post['timestamp'] = processed_post['timestamp'].isoformat() + 'Z'
            else:
                processed_post['timestamp'] = datetime.utcnow().isoformat() + 'Z' # Fallback

            # Author details for the post (will be the profile_user for all these posts)
            processed_post['author_username'] = profile_user.get('username', 'Unknown User')
            processed_post['author_profile_pic_url'] = profile_user.get('profile_pic_url', url_for('static', filename='default-profile.jpg'))
            
            # Add 'is_author' flag for the frontend delete button (checks against current logged-in user)
            processed_post['is_author'] = (current_user_obj_id == processed_post['author_id'])
            processed_post['author_id'] = str(processed_post['author_id']) # Convert author_id to string

            # Determine if the current logged-in user has liked this post
            likes_list = processed_post.get('likes', [])
            processed_post['liked_by_user'] = current_user_obj_id is not None and current_user_obj_id in likes_list
            processed_post['likes_count'] = len(likes_list)

            processed_post['image_url'] = processed_post.get('image_url', None)
            processed_post['comments_count'] = processed_post.get('comments_count', 0)
            processed_post['repost_count'] = processed_post.get('repost_count', 0)

            if 'likes' in processed_post:
                del processed_post['likes'] # Remove actual likes array

            posts_list.append(processed_post)

        return jsonify({"posts": posts_list}), 200

    except Exception as e:
        print(f"Error fetching user posts for {username}: {e}")
        return jsonify({"message": "An error occurred while fetching user posts."}), 500


if __name__ == '__main__':
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    if not os.path.exists(COMMUNITY_UPLOAD_FOLDER):
        os.makedirs(COMMUNITY_UPLOAD_FOLDER)
    app.run(debug=True)