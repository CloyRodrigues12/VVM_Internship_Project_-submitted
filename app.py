from flask import Flask, request, jsonify, send_file, make_response, render_template_string
from flask_cors import CORS
import pandas as pd
import mysql.connector
import os
from datetime import datetime, date, timedelta
import io
import xlsxwriter
import re
from collections import Counter
from functools import wraps
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
import json

# Importing the custom validation functions
from validation_students import _validate_and_prepare_student_sdcce, _validate_and_prepare_student_rms
from validation_fees import _validate_and_prepare_fees_data
# Importing the column mappings
from mappings import COLUMN_MAPPING
import chart_utils 
import dashboard_utils 
import fees_dashboard_utils

app = Flask(__name__)
CORS(app)

# Database connection configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'new_VVM_Process_db'
}

def get_db_connection():
    """Establishes a connection to the MySQL database."""
    return mysql.connector.connect(**DB_CONFIG)

app = Flask(__name__)
CORS(app, supports_credentials=True, resources={r"/*": {"origins": "*"}})


# --- App Configuration ---
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your_default_secret_key_here') # Use environment variables in production


# --- Authentication Token Decorator ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']
        
        if not token:
            return jsonify({'message': 'Authentication token is missing!'}), 401
        
        try:
            # Decode the token to get user data
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            # You could pass the current user to the route if needed, e.g., using g.current_user = data
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired! Please log in again.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token is invalid!'}), 401
            
        return f(*args, **kwargs)
    return decorated

# --- User Management Routes ---

@app.route('/register', methods=['POST'])
def register():
    db_conn = None
    cursor = None
    try:
        data = request.get_json()
        full_name = data.get('fullName')
        username = data.get('username')
        email = data.get('email')
        institution_code = data.get('institution_code')
        password = data.get('password')

        # New users default to 'Staff' role for security. Admin roles should be granted manually.
        role = 'Staff'

        if not all([full_name, username, email, role, password, institution_code]):
            return jsonify({'error': 'All fields are required.'}), 400

        db_conn = get_db_connection()
        cursor = db_conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM users WHERE email = %s OR username = %s", (email, username))
        if cursor.fetchone():
            return jsonify({'error': 'A user with this email or username already exists.'}), 409

        hashed_password = generate_password_hash(password)
        
        insert_query = """
            INSERT INTO users (full_name, username, email, role, password_hash, institution_code)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(insert_query, (full_name, username, email, role, hashed_password, institution_code))
        db_conn.commit()

        return jsonify({'message': 'Registration successful. You can now log in.'}), 201

    except Exception as e:
        print(f"Registration Error: {e}")
        return jsonify({'error': 'An internal server error occurred during registration.'}), 500
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()

@app.route('/login', methods=['POST'])
def login():
    db_conn = None
    cursor = None
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Email and password are required.'}), 400
        
        db_conn = get_db_connection()
        cursor = db_conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()

        if not user or not check_password_hash(user['password_hash'], password):
            return jsonify({'error': 'Invalid credentials. Please try again.'}), 401

        # Update last_login timestamp
        update_query = "UPDATE users SET last_login = %s WHERE id = %s"
        cursor.execute(update_query, (datetime.utcnow(), user['id']))
        db_conn.commit()

        # Generate JWT token
        token = jwt.encode({
            'user_id': user['id'],
            'username': user['username'],
            'full_name': user['full_name'],
            'role': user['role'],
            'institution_code': user.get('institution_code'),
            'exp': datetime.utcnow() + timedelta(days=1) # Session expires in 1 day
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({'token': token}), 200

    except Exception as e:
        print(f"Login Error: {e}")
        return jsonify({'error': 'An internal server error occurred during login.'}), 500
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()

# --- Helper to sanitize data for JSON ---
def sanitize_for_json(data):
    if isinstance(data, list):
        for item in data:
            sanitize_for_json(item)
    elif isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, (datetime, date)):
                data[key] = value.isoformat()
            elif isinstance(value, timedelta):
                data[key] = str(value)
    return data


# --- Public Route to Get Institutions ---
# This endpoint is now public so it can be called from the registration page
@app.route('/institutes', methods=['GET'])
def get_institutes():
    db_conn = None
    cursor = None
    try:
        db_conn = get_db_connection()
        cursor = db_conn.cursor(dictionary=True)
        
        query = "SELECT institute_name, institution_code FROM institutions ORDER BY institute_name ASC"
        cursor.execute(query)
        institutes = cursor.fetchall()
        
        return jsonify(institutes)

    except Exception as e:
        print(f"Error fetching institutes: {e}")
        return jsonify({'error': 'Could not fetch institute list from the database.'}), 500
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()

#-----------------------------dashboard-----------------------------------------------------------
@app.route('/api/dashboard/kpis', methods=['GET'])
@token_required
def get_dashboard_kpis():
    try:
        filters = {
            'institution_code': request.args.get('institution_code'),
            'batch_year': request.args.get('batch') # Note: frontend might send 'batch'
        }
        kpi_data = chart_utils.get_kpi_data(filters)
        return jsonify(kpi_data)
    except Exception as e:
        print(f"KPI Fetch Error: {e}")
        return jsonify({'error': 'Could not fetch KPI data.'}), 500

# --- NEW STUDENT DASHBOARD ENDPOINTS ---
@app.route('/api/dashboard/students', methods=['GET'])
@token_required
def get_students_data():
    try:
        filters = {key: request.args.get(key) for key in request.args}
        data = dashboard_utils.get_student_dashboard_data(filters)
        return jsonify(data)
    except Exception as e:
        return jsonify({'message': f'Could not fetch student dashboard data: {e}'}), 500
        
@app.route('/api/dashboard/fees', methods=['GET'])
@token_required
def get_fees_data():
    try:
        filters = {key: request.args.get(key) for key in request.args}
        # Handle empty date parameters
        if 'start_date' in filters and filters['start_date'] == '':
            del filters['start_date']
        if 'end_date' in filters and filters['end_date'] == '':
            del filters['end_date']
            
        data = fees_dashboard_utils.get_fees_dashboard_data(filters)
        return jsonify(sanitize_for_json(data))
    except Exception as e:
        return jsonify({'message': f'Could not fetch fees dashboard data: {e}'}), 500

@app.route('/api/students/list', methods=['GET'])
@token_required
def get_student_list_for_popup():
    try:
        filters = {key: request.args.get(key) for key in request.args}
        student_list = dashboard_utils.get_filtered_student_list(filters, is_full_list=False)
        return jsonify(sanitize_for_json(student_list))
    except Exception as e:
        return jsonify({'error': 'Could not fetch student list.'}), 500

@app.route('/api/transactions/list', methods=['GET'])
@token_required
def get_transaction_list_for_popup():
    try:
        filters = {key: request.args.get(key) for key in request.args}
        # Handle empty date parameters
        if 'start_date' in filters and filters['start_date'] == '':
            del filters['start_date']
        if 'end_date' in filters and filters['end_date'] == '':
            del filters['end_date']
            
        transaction_list = fees_dashboard_utils.get_filtered_transaction_list(filters, is_full_list=False)
        return jsonify(sanitize_for_json(transaction_list))
    except Exception as e:
        return jsonify({'error': 'Could not fetch transaction list.'}), 500

@app.route('/api/students/full-list', methods=['GET'])
@token_required
def get_full_student_list():
    try:
        filters = {key: request.args.get(key) for key in request.args}
        student_list = dashboard_utils.get_filtered_student_list(filters, is_full_list=True)
        return jsonify(sanitize_for_json(student_list))
    except Exception as e:
        return jsonify({'error': 'Could not fetch full student list.'}), 500

@app.route('/api/students/details/<identifier>', methods=['GET'])
@token_required
def get_student_details(identifier):
    try:
        identifier_type = request.args.get('identifier_type', 'student_reference_id')
        
        db_conn = get_db_connection()
        cursor = db_conn.cursor(dictionary=True)
        
        # Direct simple query
        query = f"""
        SELECT master_id, student_reference_id, student_name, institution_code,admission_no,class,section,stream,batch_year, 
        admission_scheme,student_category, admission_date, gender, mobile_number,fathers_name,fathers_occupation,mothers_name,pr_no,roll_number,email_address,
        religion,date_of_birth,blood_group,pin_code,xii_marks_obtained,xii_sub_combination,full_address,city,state,alt_mobile_number,fathers_mobile_number,mothers_mobile_number,pwd_category_and_Percentage,xii_passing_class,mothers_occupation,nationality,mother_tongue,board_name,xii_stream,passing_year,name_of_the_institution_attended_earlier
        FROM students_details_master 
        WHERE {identifier_type} = %s
        """
        
        cursor.execute(query, (identifier,))
        student_data = cursor.fetchone()
        
        if not student_data:
            return jsonify({'error': 'Student not found'}), 404
            
        return jsonify({
            'details': student_data,
            'fees': []  # Empty array since we're not linking fees
        })
        
    except Exception as e:
        print(f"Error in student details: {e}")
        return jsonify({'error': 'Could not fetch student details'}), 500
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()
        
@app.route('/api/filter-options', methods=['GET'])
@token_required
def get_filter_options():
    try:
        batches = dashboard_utils.get_distinct_filter_values('batch_year')
        genders = dashboard_utils.get_distinct_filter_values('gender')
        categories = dashboard_utils.get_distinct_filter_values('student_category')
        return jsonify({
            'batches': [b['batch_year'] for b in batches],
            'genders': [g['gender'] for g in genders],
            'student_categories': [c['student_category'] for c in categories]
        })
    except Exception as e:
        return jsonify({'error': 'Could not fetch filter options.'}), 500

@app.route('/api/fees/filter-options', methods=['GET'])
@token_required
def get_fees_filter_options():
    try:
        options = fees_dashboard_utils.get_fees_filter_options()
        return jsonify(options)
    except Exception as e:
        return jsonify({'error': 'Could not fetch fees filter options.'}), 500
        
@app.route('/api/export/excel', methods=['POST'])
@token_required
def export_excel():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided for export'}), 400
        
        excel_file = dashboard_utils.export_students_to_excel(data)
        return send_file(
            excel_file,
            as_attachment=True,
            download_name='export_data.xlsx',
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        return jsonify({'error': 'Failed to export data.'}), 500


#-----------------------------dashboard ends-----------------------------------------------------------



#-----------------------------------------------------------------------------------------------------------------------        

# --- New Database View and Update Routes ---

@app.route('/api/table-schema/<table_name>', methods=['GET'])
@token_required
def get_table_schema(table_name):
    """Gets the column names for a given table."""
    if table_name not in ['students_details_master', 'student_fee_transactions']:
        return jsonify({'error': 'Invalid table name'}), 400
    
    db_conn = None
    cursor = None
    try:
        db_conn = get_db_connection()
        cursor = db_conn.cursor()
        cursor.execute(f"SHOW COLUMNS FROM {table_name}")
        columns = [row[0] for row in cursor.fetchall()]
        
        return jsonify(columns)
    except Exception as e:
        print(f"Schema Fetch Error: {e}")
        return jsonify({'error': 'Could not fetch table schema.'}), 500
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()


from datetime import datetime, date, timedelta

@app.route('/api/table-data/<table_name>', methods=['GET'])
@token_required
def get_table_data(table_name):
    """Fetches paginated and searchable data from the specified table."""
    if table_name not in ['students_details_master', 'student_fee_transactions']:
        return jsonify({'error': 'Invalid table name'}), 400
    
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)
    search_term = request.args.get('search', '')
    search_column = request.args.get('column', '')
    offset = (page - 1) * limit

    db_conn = None
    cursor = None
    try:
        db_conn = get_db_connection()
        cursor = db_conn.cursor(dictionary=True)

        # Base queries
        count_query = f"SELECT COUNT(*) as total FROM {table_name}"
        data_query = f"SELECT * FROM {table_name}"

        where_clauses = []
        params = []

        # Handle search logic
        if search_term:
            search_like_term = f"%{search_term}%"
            if search_column:
                where_clauses.append(f"{search_column} LIKE %s")
                params.append(search_like_term)
            else:
                cursor.execute(f"SHOW COLUMNS FROM {table_name}")
                columns = [row['Field'] for row in cursor.fetchall()]
                search_clauses = [f"{col} LIKE %s" for col in columns]
                where_clauses.append(f"({' OR '.join(search_clauses)})")
                params.extend([search_like_term] * len(columns))
        
        if where_clauses:
            query_where_part = " WHERE " + " AND ".join(where_clauses)
            count_query += query_where_part
            data_query += query_where_part

        # Get total count for pagination
        cursor.execute(count_query, params)
        total_records = cursor.fetchone()['total']
        
        # Add ordering and pagination
        id_column = 'master_id' if table_name == 'students_details_master' else 'fees_trans_id'
        data_query += f" ORDER BY {id_column} DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        cursor.execute(data_query, params)
        data = cursor.fetchall()
        
        # Convert non-serializable types
        for row in data:
            for key, value in row.items():
                if isinstance(value, (datetime, date)):
                    row[key] = value.isoformat()
                elif isinstance(value, timedelta):
                    # Convert TIME to "HH:MM:SS"
                    total_seconds = int(value.total_seconds())
                    hours, remainder = divmod(total_seconds, 3600)
                    minutes, seconds = divmod(remainder, 60)
                    row[key] = f"{hours:02}:{minutes:02}:{seconds:02}"

        return jsonify({
            'data': data,
            'total': total_records,
            'page': page,
            'limit': limit
        })

    except mysql.connector.Error as err:
        print(f"Data Fetch Error: {err}")
        return jsonify({'error': f'Database error: {err.msg}'}), 500
    except Exception as e:
        print(f"Data Fetch Error: {e}")
        return jsonify({'error': 'Could not fetch data.'}), 500
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()


@app.route('/api/update-record/<table_name>', methods=['POST'])
@token_required
def update_record(table_name):
    """Updates a single record in a table."""
    if table_name not in ['students_details_master', 'student_fee_transactions']:
        return jsonify({'error': 'Invalid table name'}), 400
    
    data = request.get_json()
    record_id = data.get('id')
    column = data.get('column')
    value = data.get('value')
    
    # Allow empty strings
    if not all([record_id, column]) or value is None:
         return jsonify({'error': 'Missing data for update'}), 400

    db_conn = None
    cursor = None
    try:
        db_conn = get_db_connection()
        cursor = db_conn.cursor()
        
        id_column = 'master_id' if table_name == 'students_details_master' else 'fees_trans_id'

        query = f"UPDATE {table_name} SET {column} = %s WHERE {id_column} = %s"
        cursor.execute(query, (value, record_id))
        db_conn.commit()

        return jsonify({'message': 'Record updated successfully'}), 200

    except mysql.connector.Error as err:
        print(f"Record Update Error: {err}")
        db_conn.rollback()
        return jsonify({'error': f"Failed to update record: {err.msg}"}), 500
    except Exception as e:
        print(f"Record Update Error: {e}")
        db_conn.rollback()
        return jsonify({'error': 'Failed to update record.'}), 500
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()

#----------------------------------------------------------------------------------------------------
# --- Bulk Update Routes ---
# --- Bulk Update Routes ---

@app.route('/api/bulk-update/download-template', methods=['GET'])
@token_required
def download_bulk_template():
    table_name = request.args.get('table_name')
    identifier_column = request.args.get('identifier_column')
    update_columns_json = request.args.get('update_columns')

    if not all([table_name, identifier_column, update_columns_json]):
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        update_columns = json.loads(update_columns_json)
        headers = [identifier_column] + update_columns
        df = pd.DataFrame(columns=headers)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name='Bulk Update Template')
            worksheet = writer.sheets['Bulk Update Template']
            for i, col in enumerate(df.columns):
                worksheet.set_column(i, i, len(col) + 5)
        output.seek(0)
        
        filename = f"bulk_update_{table_name}_template.xlsx"
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/bulk-update/preview-upload', methods=['POST'])
@token_required
def preview_bulk_upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    table_name = request.form.get('table_name')
    identifier_column = request.form.get('identifier_column')

    if not all([file, table_name, identifier_column]):
        return jsonify({'error': 'Missing required form data'}), 400

    db_conn = None
    cursor = None
    try:
        df = pd.read_excel(file)
        df.columns = df.columns.str.strip()

        if identifier_column not in df.columns:
            return jsonify({'error': f"Identifier column '{identifier_column}' not found in the uploaded file."}), 400

        ids_to_check = df[identifier_column].dropna().unique().tolist()
        
        # *** BUG FIX STARTS HERE ***
        # If there are no IDs in the identifier column, there's nothing to check.
        if not ids_to_check:
            return jsonify({
                'valid_updates': [],
                'invalid_rows': []
            })
        # *** BUG FIX ENDS HERE ***

        db_conn = get_db_connection()
        cursor = db_conn.cursor(dictionary=True)

        query = f"SELECT `{identifier_column}` FROM {table_name} WHERE `{identifier_column}` IN ({', '.join(['%s'] * len(ids_to_check))})"
        cursor.execute(query, ids_to_check)
        existing_ids = {str(row[identifier_column]) for row in cursor.fetchall()}

        valid_updates = []
        invalid_rows = []
        
        update_columns = [col for col in df.columns if col != identifier_column]

        for index, row in df.iterrows():
            identifier_value = str(row[identifier_column])
            if identifier_value in existing_ids:
                updates = {}
                for col in update_columns:
                    if pd.notna(row[col]):
                        updates[col] = row[col]
                if updates:
                    valid_updates.append({'id': identifier_value, 'updates': updates})
            else:
                invalid_rows.append({'id': identifier_value, 'reason': 'Not found in database'})

        return jsonify({
            'valid_updates': valid_updates,
            'invalid_rows': invalid_rows
        })

    except Exception as e:
        return jsonify({'error': f'Error processing file: {str(e)}'}), 500
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()

@app.route('/api/bulk-update/execute', methods=['POST'])
@token_required
def execute_bulk_update():
    data = request.get_json()
    table_name = data.get('table_name')
    identifier_column = data.get('identifier_column')
    updates = data.get('updates')

    if not all([table_name, identifier_column, updates]):
        return jsonify({'error': 'Missing data for execution.'}), 400
    
    db_conn = None
    cursor = None
    updated_count = 0
    try:
        db_conn = get_db_connection()
        cursor = db_conn.cursor()
        db_conn.start_transaction()

        for update_item in updates:
            record_id = update_item['id']
            changes = update_item['updates']
            
            set_clauses = []
            params = []
            for col, val in changes.items():
                set_clauses.append(f"`{col}` = %s")
                params.append(val)
            
            params.append(record_id)
            
            query = f"UPDATE {table_name} SET {', '.join(set_clauses)} WHERE `{identifier_column}` = %s"
            cursor.execute(query, params)
            updated_count += cursor.rowcount

        db_conn.commit()
        return jsonify({
            'message': 'Bulk update completed successfully.',
            'updated_count': updated_count,
            'skipped_count': len(updates) - updated_count
        })
    except mysql.connector.Error as err:
        if db_conn: db_conn.rollback()
        return jsonify({'error': f"Database error during update: {err.msg}"}), 500
    except Exception as e:
        if db_conn: db_conn.rollback()
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), 500
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()


#----------------------------------------------------------------------------------------------

@app.route('/check_filename', methods=['POST', 'OPTIONS'])
def check_filename():
    """Checks if a filename already exists in the database."""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
        
    db_conn = None
    cursor = None
    try:
        data = request.get_json()
        filename = data.get('filename')
        if not filename:
            return jsonify({'error': 'Filename is required.'}), 400

        db_conn = get_db_connection()
        # Use a buffered cursor to prevent "Unread result found" errors
        cursor = db_conn.cursor(buffered=True)
        
        query = "SELECT 1 FROM user_upload_details WHERE file_name = %s"
        cursor.execute(query, (filename,))
        result = cursor.fetchone()
        
        return jsonify({'exists': result is not None})

    except Exception as e:
        print(f"Error checking filename: {e}")
        return jsonify({'error': 'Could not check filename in the database.'}), 500
    finally:
        if cursor:
            cursor.close()
        if db_conn and db_conn.is_connected():
            db_conn.close()

def _build_cors_preflight_response():
    response = make_response()
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
    response.headers.add('Access-Control-Allow-Methods', "GET,POST,OPTIONS")
    return response


def sanitize_column_name(column_name):
    """
    Converts column names to lowercase and replaces spaces with underscores.
    Removes dots, apostrophes, and parentheses.
    """
    sanitized = str(column_name).lower()
    sanitized = sanitized.replace(' ', '_')
    sanitized = sanitized.replace('-', '_')
    sanitized = sanitized.replace('.', '')
    sanitized = sanitized.replace("'", '')
    sanitized = sanitized.replace("(", '')
    sanitized = sanitized.replace(")", '')
    sanitized = sanitized.replace("-", '')
    sanitized = sanitized.replace("?", '')
    return sanitized


def _resolve_empty_duplicates(df):
    """
    Pre-processes a DataFrame to resolve a specific duplicate column scenario.
    
    If a column name appears multiple times, and exactly ONE of those columns
    contains data while the others are completely empty (all NaN), this function
    will silently drop the empty duplicate(s).
    
    In all other cases (no duplicates, or multiple duplicates with data),
    it does nothing, allowing the downstream logic to handle it.
    
    Args:
        df (pd.DataFrame): The input DataFrame.
    
    Returns:
        pd.DataFrame: The processed DataFrame with empty duplicates removed.
    """
    # Find column names that appear more than once
    col_counts = Counter(df.columns)
    duplicate_names = {name for name, count in col_counts.items() if count > 1}
    
    if not duplicate_names:
        # No duplicates found, return the DataFrame as is.
        return df

    cols_to_drop_indices = []
    
    for name in duplicate_names:
        # Get the integer indices of all columns with this duplicate name
        all_indices = [i for i, col_name in enumerate(df.columns) if col_name == name]
        
        non_empty_indices = []
        empty_indices = []
        
        for i in all_indices:
            # Check if the column at this specific index is entirely empty
            if df.iloc[:, i].isnull().all():
                empty_indices.append(i)
            else:
                non_empty_indices.append(i)
        
        # This is the key condition: if there is EXACTLY one column with data
        # among the duplicates, we mark the empty ones for removal.
        if len(non_empty_indices) == 1:
            print(f"Resolving duplicates for '{name}': Found one column with data. Dropping {len(empty_indices)} empty column(s).")
            cols_to_drop_indices.extend(empty_indices)
            
    if cols_to_drop_indices:
        # Drop the identified empty columns by their integer index
        df = df.drop(df.columns[cols_to_drop_indices], axis=1)
        
    return df


def read_file(file, file_name, column_map):
    """
    Reads an Excel or CSV file, identifies the header row based on a fixed number of key headers,
    and returns the DataFrame.
    """
    file_extension = os.path.splitext(file_name)[1].lower()

    if file_extension in ['.xlsx', '.xls']:
        read_func = pd.read_excel
    elif file_extension == '.csv':
        read_func = pd.read_csv
    else:
        raise ValueError("Unsupported file type. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.")
    
    try:
        # Read the first 20 rows to be sure we don't miss the header
        df_test = read_func(file, header=None, nrows=20)
        file.seek(0)
    except Exception as e:
        raise Exception(f"Error reading initial rows for header detection: {e}")

    MIN_REQUIRED_MATCHES = 5
    expected_sanitized_headers = {sanitize_column_name(k) for k in column_map.keys()}
    
    header_row_index = None
    for i in range(df_test.shape[0]):
        # If the first 10 columns are all empty, skip this row as it's likely a blank line.
        if df_test.iloc[i, :10].isna().all():
            print(f"Skipping row {i} because the first 10 columns are empty.")
            continue
        
        row_values = df_test.iloc[i].dropna().apply(str).apply(sanitize_column_name).tolist()
        matches = len(set(row_values) & expected_sanitized_headers)
        
        if matches >= MIN_REQUIRED_MATCHES:
            header_row_index = i
            break
    
    if header_row_index is None:
        raise ValueError('Could not find a suitable header row. The file does not contain enough matching columns to be processed.')

    df = read_func(file, header=header_row_index)
    return df, header_row_index


def process_and_validate_columns(df, column_map):
    """
    Processes and validates columns, correctly handling multiple source columns
    (including duplicate column names and names with extra spaces) mapping to a
    single destination column in a case-insensitive manner.
    """
    # --- Step 1: Standardize the DataFrame's column names ---
    # Convert to lowercase AND strip any leading/trailing whitespace
    df.columns = df.columns.str.lower().str.strip()
    
    # --- Step 2: Create a reverse map from destination DB col to a LIST of lowercase source cols ---
    db_to_source_map = {}
    for source_col, db_col in column_map.items():
        # Sanitize the mapping key just like the column names
        source_col_sanitized = source_col.lower().strip()
        if db_col not in db_to_source_map:
            db_to_source_map[db_col] = []
        db_to_source_map[db_col].append(source_col_sanitized)

    final_df = pd.DataFrame()
    
    # Get a unique, ordered list of expected database columns
    expected_db_cols = list(dict.fromkeys(column_map.values()))

    # --- Step 3: Iterate through each unique destination column ---
    for db_col in expected_db_cols:
        possible_source_cols = db_to_source_map.get(db_col, [])
        source_cols_in_df = [col for col in possible_source_cols if col in df.columns]
        
        if not source_cols_in_df:
            final_df[db_col] = pd.NA
            continue

        # --- Step 4: SIMPLIFIED AND HARDENED MERGE LOGIC ---
        # This logic handles all cases: single columns, multiple different columns,
        # and multiple columns with the SAME duplicate name.
        sub_df = df[source_cols_in_df]
        merged_series = sub_df.bfill(axis=1).iloc[:, 0]
        final_df[db_col] = merged_series

    # Ensure the final DataFrame has all expected columns in the correct order
    return final_df.reindex(columns=expected_db_cols)

@app.route('/preview', methods=['POST'])
def preview_file():
    """
    Reads an Excel or CSV file and returns a preview of the processed data.
    """
    try:
        file = request.files.get('file')
        table_type = request.form.get('tableType')
        institution_code = request.form.get('institution_code')

        if not file or not table_type or not institution_code:
            return jsonify({'error': 'Missing required form data for preview'}), 400

        column_map = {}
        if table_type == 'Student Details':
            if institution_code in ['SDCCE', 'GRKCL']:
                column_map = COLUMN_MAPPING['students_sdcce_grkcl']
            elif institution_code in ['RMS', 'VVA']:
                column_map = COLUMN_MAPPING['students_rms_vva']
            else:
                return jsonify({'error': 'Invalid institution code for student upload'}), 400
        elif table_type == 'Fees Summary Report':
            column_map = COLUMN_MAPPING['fees']
        else:
            return jsonify({'error': 'Invalid file type'}), 400
        
        df, header_row_index = read_file(file, file.filename, column_map)

        df = _resolve_empty_duplicates(df) 
        
        # Check for duplicate rows BEFORE any further processing
        df['original_row_number'] = df.index + header_row_index + 2
        
        # Check for duplicates across all columns
        duplicate_rows = df[df.duplicated(subset=df.columns[:-1], keep=False)].sort_values(by=list(df.columns[:-1]))
        
        if not duplicate_rows.empty:
            duplicate_info = {}
            for index, row in duplicate_rows.iterrows():
                row_tuple = tuple(row.iloc[:-1])
                if row_tuple not in duplicate_info:
                    duplicate_info[row_tuple] = []
                duplicate_info[row_tuple].append(row['original_row_number'])

            duplicates_list = []
            for rows in duplicate_info.values():
                if len(rows) > 1:
                    duplicates_list.append({
                        'count': len(rows),
                        'row_numbers': sorted(rows)
                    })
            
            if duplicates_list:
                error_message = f"Duplicate rows detected. Total duplicate sets: {len(duplicates_list)}. Please fix the file before uploading."
                return jsonify({
                    'error': error_message,
                    'details': duplicates_list
                }), 409 # 409 Conflict

        df.drop('original_row_number', axis=1, inplace=True)

        final_df = process_and_validate_columns(df, column_map)
        
        # Drop rows with fewer than 3 non-NA values
        final_df = final_df.dropna(axis=0, thresh=7)

        if final_df.empty:
            return jsonify({'error': 'No matching columns found in the uploaded file.'}), 400
        
        cols_to_drop = [col for col in final_df.columns if final_df[col].isna().all()]
        final_df = final_df.drop(columns=cols_to_drop)

        date_columns = ['admission_date', 'date_of_birth','due_date','fees_paid_date','settlement_date','refund_date']
        for col in date_columns:
            if col in final_df.columns:
                final_df[col] = pd.to_datetime(final_df[col], errors='coerce').dt.strftime('%d-%m-%Y').fillna('N/A')

        preview_data = final_df.fillna(' ').values.tolist()
        headers = list(final_df.columns)
        
        return jsonify({'headers': headers, 'preview_data': preview_data}), 200

    except ValueError as ve:
        print(f"Validation error: {ve}")
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/upload', methods=['POST'])
def upload_file():
    """
    Handles the file upload and inserts data into the staging tables.
    """
    try:
        file = request.files.get('file')
        table_type = request.form.get('tableType')
        institution_code = request.form.get('institution_code')
        # Use .get() with a default value of '-' for academic year and quarter
        academic_year = request.form.get('academicYear', '-')
        academic_quarter = request.form.get('academicQuarter', '-')

        if not file or not table_type or not institution_code:
            return jsonify({'error': 'Missing required form data'}), 400
        
        column_map = {}
        target_table = ""
        if table_type == 'Student Details':
            if institution_code in ['SDCCE', 'GRKCL']:
                target_table = 'stg_sdcce_grkcl_student_details'
                column_map = COLUMN_MAPPING['students_sdcce_grkcl']
            elif institution_code in ['RMS', 'VVA']:
                target_table = 'stg_rms_vva_student_details'
                column_map = COLUMN_MAPPING['students_rms_vva']
            else:
                return jsonify({'error': 'Invalid institution code for student upload'}), 400
        elif table_type == 'Fees Summary Report':
            target_table = 'stg_fees_details'
            column_map = COLUMN_MAPPING['fees']
        else:
            return jsonify({'error': 'Invalid file type'}), 400

        df, _ = read_file(file, file.filename, column_map)

        df = _resolve_empty_duplicates(df)
        
        # Check for duplicates a second time to be safe.
        if df.duplicated().any():
            return jsonify({'error': 'Duplicate rows detected in the uploaded file. Please remove them before uploading.'}), 409
        
        db_conn = get_db_connection()
        cursor = db_conn.cursor()

        insert_metadata_query = """
            INSERT INTO user_upload_details 
            (institution_code, file_name, table_type, academic_year, academic_quarter)
            VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(insert_metadata_query, 
                        (institution_code, file.filename, table_type, academic_year, academic_quarter))
        db_conn.commit()
        uploaded_file_id = cursor.lastrowid

        final_df = process_and_validate_columns(df, column_map)

        # Drop rows with fewer than 3 non-NA values
        final_df = final_df.dropna(axis=0, thresh=7)
        
        if final_df.empty:
            return jsonify({'error': 'No matching columns found in the uploaded file.'}), 400
        
        if not final_df.empty:
            last_row = final_df.iloc[-1]
            non_empty_count = last_row.dropna().count()
            if non_empty_count <= 2:
                print(f"Detected and dropped a potential footer row: {last_row.to_dict()}")
                final_df = final_df.iloc[:-1]
                

        final_df['uploaded_file_id'] = uploaded_file_id
      
      # Get a UNIQUE, ordered list of database columns from the mapping
        unique_db_cols = list(dict.fromkeys(column_map.values()))

      # Reorder the DataFrame to match the unique column list for insertion
        final_df = final_df[['uploaded_file_id'] + unique_db_cols]
      
        insert_template = ', '.join(['%s'] * len(final_df.columns))
        insert_query = f"""
            INSERT INTO {target_table} ({', '.join(final_df.columns)})
            VALUES ({insert_template})
        """
        
        data_to_insert = [tuple(None if pd.isna(item) else item for item in row) for row in final_df.to_numpy()]
        
        chunk_size = 500  # Number of rows to insert per batch. A safe start.
        total_rows = len(data_to_insert)

        if total_rows > 0:
            print(f"Total rows to insert: {total_rows}. Processing in chunks of {chunk_size}.")
            
            # Loop through the data in chunks and execute the insert for each chunk
            for i in range(0, total_rows, chunk_size):
                chunk = data_to_insert[i:i + chunk_size]
                cursor.executemany(insert_query, chunk)
                print(f"Successfully inserted chunk starting at row {i+1}")
        
        # Commit the entire transaction after all chunks are successfully inserted
        db_conn.commit()

        cursor.close()
        db_conn.close()

        return jsonify({'message': 'File uploaded successfully!', 'uploaded_file_id': uploaded_file_id}), 200

    except ValueError as ve:
        print(f"Validation error: {ve}")
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        print(f"Error: {e}")
        if 'db_conn' in locals() and db_conn.is_connected():
            db_conn.close()
        return jsonify({'error': str(e)}), 500
    
@app.route('/download_sample', methods=['GET'])
def download_sample_file():
    """Generates and returns an empty Excel template based on file type and institute."""
    try:
        file_type = request.args.get('fileType')
        institution_code = request.args.get('institution_code')

        if not file_type or not institution_code:
            return jsonify({'error': 'Missing required parameters: fileType and institution_code'}), 400

        target_table_name = ""
        column_map = {}
        if file_type == 'Student Details':
            if institution_code in ['SDCCE', 'GRKCL']:
                column_map = COLUMN_MAPPING['students_sdcce_grkcl']
                target_table_name = 'stg_sdcce_grkcl_student_details'
            elif institution_code in ['RMS', 'VVA']:
                column_map = COLUMN_MAPPING['students_rms_vva']
                target_table_name = 'stg_rms_vva_student_details'
            else:
                return jsonify({'error': 'Invalid institution code for student upload'}), 400
        elif file_type == 'Fees Summary Report':
            column_map = COLUMN_MAPPING['fees']
            target_table_name = 'stg_fees_details'
        else:
            return jsonify({'error': 'Invalid file type'}), 400
            
        template_headers = list(column_map.keys())
        df = pd.DataFrame(columns=template_headers)

        output = io.BytesIO()

        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name='Sheet1')
            workbook = writer.book
            worksheet = writer.sheets['Sheet1']
            
            for i, col in enumerate(df.columns):
                max_len = len(col) + 2
                worksheet.set_column(i, i, max_len)
        output.seek(0)
        
        filename = f"{target_table_name}.xlsx"
    
        response = make_response(output.getvalue())
        response.headers['Content-Type']= 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Disposition'

        return response

    except Exception as e:
        print(f"Error generating sample file: {e}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/process_upload', methods=['POST'])
def process_upload():
    """
    Validates and moves data from the staging table to the master table
    using an explicit, all-or-nothing transaction.
    """
    db_conn = None
    cursor = None
    try:
        data = request.get_json()
        uploaded_file_id = data.get('uploaded_file_id')
        table_type = data.get('table_type')
        institution_code = data.get('institution_code')
        
        if not all([uploaded_file_id, table_type, institution_code]):
            return jsonify({'error': 'Missing required data for processing'}), 400
        
        db_conn = get_db_connection()
        db_conn.autocommit = False  
        cursor = db_conn.cursor(dictionary=True)

        metadata_query = "SELECT academic_year, academic_quarter FROM user_upload_details WHERE upload_id = %s"
        cursor.execute(metadata_query, (uploaded_file_id,))
        metadata = cursor.fetchone()
        if not metadata:
            return jsonify({'error': 'Metadata for this upload not found.'}), 404
        academic_year = metadata['academic_year']
        academic_quarter = metadata['academic_quarter']

        staging_table = ''
        master_table = ''
        
        if table_type == 'Student Details':
            if institution_code in ['SDCCE', 'GRKCL']:
                staging_table = 'stg_sdcce_grkcl_student_details'
                master_table = 'students_details_master'
            elif institution_code in ['RMS', 'VVA']:
                staging_table = 'stg_rms_vva_student_details'
                master_table = 'students_details_master'
            else:
                return jsonify({'error': 'Invalid institution code for student processing'}), 400
        elif table_type == 'Fees Summary Report':
            staging_table = 'stg_fees_details'
            master_table = 'student_fee_transactions'
        else:
            return jsonify({'error': 'Invalid table type for processing'}), 400
        
        select_query = f"SELECT * FROM {staging_table} WHERE uploaded_file_id = %s"
        cursor.execute(select_query, (uploaded_file_id,))
        staging_records = cursor.fetchall()
        
        if not staging_records:
            return jsonify({'message': 'No records found in staging table to process.'})

        processed_count = 0
        error_count = 0
        errors = []
        successful_insertions = []

        for i, record in enumerate(staging_records):
            row_number = i + 1
            master_insert_query = None
            values = None
            validation_errors = []

            result = None
            if table_type == 'Student Details':
                if institution_code in ['SDCCE', 'GRKCL']:
                    result = _validate_and_prepare_student_sdcce(cursor, record, institution_code, master_table)
                elif institution_code in ['RMS', 'VVA']:
                    result = _validate_and_prepare_student_rms(cursor, record, institution_code, master_table, academic_year, academic_quarter)
            elif table_type == 'Fees Summary Report':
                result = _validate_and_prepare_fees_data(cursor, record, uploaded_file_id, master_table, academic_year, academic_quarter, institution_code)

            if result is not None:
                master_insert_query, values, validation_errors = result
            else:
                validation_errors.append("Internal validation error: The validation function returned an unexpected value.")
            
            if not validation_errors and master_insert_query:
                successful_insertions.append({'query': master_insert_query, 'values': values})
                processed_count += 1
            else:
                error_count += 1
                errors.append({
                    'row_number': row_number,
                    'record_data': record,
                    'error_messages': validation_errors
                })

        if error_count > 0:
            db_conn.rollback()
            message = "Processing failed. No records were moved due to validation errors."
        else:
            for insertion in successful_insertions:
                cursor.execute(insertion['query'], insertion['values'])
            db_conn.commit()
            message = "Processing complete. All records successfully inserted."

        try:
            delete_staging_query = f"DELETE FROM {staging_table} WHERE uploaded_file_id = %s"
            cursor.close()
            cursor = db_conn.cursor()
            cursor.execute(delete_staging_query, (uploaded_file_id,))
            deleted_count = cursor.rowcount
            db_conn.commit()
            print(f"Cleanup: {deleted_count} rows deleted from {staging_table}")
        except Exception as cleanup_err:
            db_conn.rollback()
            print(f"Cleanup failed: {cleanup_err}")

        cursor.close()
        db_conn.close()
        
        return jsonify({
             'message': message,
             'total_records': len(staging_records),
             'processed_count': processed_count if error_count == 0 else 0,
             'error_count': error_count,
             'errors': errors
        }), 200

    except Exception as e:
        print(f"Error during processing: {e}")
        if db_conn and db_conn.is_connected():
            db_conn.rollback()
            db_conn.close()
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/transactions/revenue-details', methods=['GET'])
@token_required
def get_revenue_details():
    try:
        filters = {key: request.args.get(key) for key in request.args}
        # Handle empty date parameters
        if 'start_date' in filters and filters['start_date'] == '':
            del filters['start_date']
        if 'end_date' in filters and filters['end_date'] == '':
            del filters['end_date']
            
        # You'll need to implement this function in fees_dashboard_utils
        revenue_data = fees_dashboard_utils.get_revenue_transaction_details(filters)
        return jsonify(sanitize_for_json(revenue_data))
    except Exception as e:
        return jsonify({'error': 'Could not fetch revenue details.'}), 500

@app.route('/api/dashboard/fee-summary')
def get_fee_summary():
    try:
        filters = {
            'institution_code': request.args.get('institution_code', 'all'),
            'batch_year': request.args.get('batch_year')
        }
        data = chart_utils.get_fee_summary_data(filters)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/student-demographics')
def get_student_demographics():
    try:
        filters = {
            'institution_code': request.args.get('institution_code', 'all'),
            'batch_year': request.args.get('batch_year')
        }
        data = chart_utils.get_student_demographics(filters)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/transactions/kpi-details', methods=['GET'])
@token_required
def get_kpi_details_route():
    try:
        filters = request.args.to_dict()
        data = fees_dashboard_utils.get_kpi_details(filters)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)


import chart_utils

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend-backend communication

@app.route('/api/dashboard/kpis', methods=['GET'])
def get_kpi_data():
    try:
        institution_code = request.args.get('institution_code', 'all')
        filters = {'institution_code': institution_code}
        
        kpi_data = chart_utils.get_kpi_data(filters)
        return jsonify(kpi_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/fee-summary', methods=['GET'])
def get_fee_summary():
    try:
        institution_code = request.args.get('institution_code', 'all')
        filters = {'institution_code': institution_code}
        
        fee_data = chart_utils.get_fee_summary_data(filters)
        return jsonify(fee_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/student-demographics', methods=['GET'])
def get_student_demographics():
    try:
        institution_code = request.args.get('institution_code', 'all')
        filters = {'institution_code': institution_code}
        
        demo_data = chart_utils.get_student_demographics(filters)
        return jsonify(demo_data), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/institutes', methods=['GET'])
def get_institutes():
    try:
        # Add authentication check if needed
        db_conn = chart_utils.get_db_connection()
        cursor = db_conn.cursor(dictionary=True)
        
        query = "SELECT institution_code, institution_name FROM institutions"
        cursor.execute(query)
        institutes = cursor.fetchall()
        
        cursor.close()
        db_conn.close()
        
        return jsonify(institutes), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=3306)
    
# chart_utils.py (updated)
from flask import Flask, jsonify, request
from flask_cors import CORS
import mysql.connector

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])  # Explicitly allow React dev server

# Database Configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'new_vvm_process_db',
    'port': 3306  # Explicitly set MySQL port
}

def get_db_connection():
    """Establishes a connection to the MySQL database."""
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except mysql.connector.Error as err:
        print(f"Database connection error: {err}")
        return None

@app.route('/api/dashboard/data', methods=['GET'])
def dashboard_data():
    """
    Fetches all aggregated data for the dashboard.
    """
    db_conn = None
    cursor = None
    try:
        db_conn = get_db_connection()
        if not db_conn:
            return jsonify({'error': 'Database connection failed'}), 500
            
        cursor = db_conn.cursor(dictionary=True)

        # KPI query
        kpi_query = """
            SELECT 
                COUNT(*) as total_students, 
                COUNT(CASE WHEN gender = 'Male' THEN 1 END) as male_students,
                COUNT(CASE WHEN gender = 'Female' THEN 1 END) as female_students
            FROM students_details_master
        """
        cursor.execute(kpi_query)
        kpis = cursor.fetchone()

        def fetch_chart_data(column, order_by='count DESC', limit=10):
            query = f"""
                SELECT {column}, COUNT(*) as count 
                FROM students_details_master
                WHERE {column} IS NOT NULL AND {column} != '' 
                GROUP BY {column} 
                ORDER BY {order_by}
                LIMIT {limit}
            """
            cursor.execute(query)
            return cursor.fetchall()
        
        # Fetch chart data
        class_dist = fetch_chart_data('class', order_by='class ASC')
        stream_dist = fetch_chart_data('stream')
        gender_dist = fetch_chart_data('gender')
        category_dist = fetch_chart_data('student_category')
        religion_dist = fetch_chart_data('religion')
        blood_group_dist = fetch_chart_data('blood_group')
        state_dist = fetch_chart_data('state')

        return jsonify({
            'kpis': kpis, 
            'classDistribution': class_dist, 
            'streamDistribution': stream_dist,
            'genderDistribution': gender_dist, 
            'categoryDistribution': category_dist,
            'religionDistribution': religion_dist, 
            'bloodGroupDistribution': blood_group_dist,
            'stateDistribution': state_dist
        })
    except Exception as e:
        print(f"Error in get_dashboard_data: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()

@app.route('/api/test', methods=['GET'])
def test_connection():
    """Test endpoint to verify the API is working"""
    return jsonify({'message': 'API is working!'})

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')  # Allow external connections