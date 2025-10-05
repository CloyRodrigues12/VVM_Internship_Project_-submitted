import mysql.connector
from flask import jsonify
from datetime import date, datetime, timedelta
import pandas as pd
import io

# --- Database Connection ---
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'new_VVM_Process_db'
}

def get_db_connection():
    """Establishes a connection to the MySQL database."""
    return mysql.connector.connect(**DB_CONFIG)

def _build_where_clause(filters):
    """
    Helper function to build a robust WHERE clause from various filter parameters.
    """
    where_clauses = []
    params = []
    
    # --- Standard Filters ---
    if filters.get('institution_code') and filters['institution_code'] != 'all':
        where_clauses.append("institution_code = %s")
        params.append(filters['institution_code'])
    
    if filters.get('batch_year') and filters['batch_year'] != 'all':
        where_clauses.append("batch_year = %s")
        params.append(filters['batch_year'])
        
    # --- Advanced Filters ---
    if filters.get('gender') and filters['gender'] != 'all':
        where_clauses.append("gender = %s")
        params.append(filters['gender'])

    if filters.get('student_category') and filters['student_category'] != 'all':
        where_clauses.append("student_category = %s")
        params.append(filters['student_category'])

    # --- Chart Drill-Down Filters ---
    filter_type = filters.get('filterType')
    filter_value = filters.get('filterValue')

    if filter_type and filter_value and filter_value != 'all':
        allowed_columns = [
            'gender', 'religion', 'blood_group', 'student_category', 
            'fathers_occupation', 'mothers_occupation', 'stream', 
            'class', 'pin_code', 'state', 'age_group', 'mother_tongue',
            'urban_rural_category', 'city',
            'name_of_the_institution_attended_earlier'
        ]
        
        if filter_type in allowed_columns:
            # Special handling for age_group (calculated field)
            if filter_type == 'age_group':
                age_conditions = {
                    'Under 18': "TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) < 18",
                    '18-20': "TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) BETWEEN 18 AND 20",
                    '21-23': "TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) BETWEEN 21 AND 23",
                    'Over 23': "TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) > 23"
                }
                
                if filter_value in age_conditions:
                    where_clauses.append(age_conditions[filter_value])
            else:
                where_clauses.append(f"{filter_type} = %s")
                params.append(filter_value)

    where_clause_str = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    return where_clause_str, params

def get_student_dashboard_data(filters):
    """
    Fetches all aggregated data for the student dashboard.
    """
    db_conn = None
    cursor = None
    try:
        db_conn = get_db_connection()
        cursor = db_conn.cursor(dictionary=True)
        
        where_clause, params = _build_where_clause(filters)

        # Updated KPI query to include male and female counts
        kpi_query = f"""
            SELECT 
                COUNT(*) as total_students, 
                COUNT(CASE WHEN gender = 'Male' THEN 1 END) as male_students,
                COUNT(CASE WHEN gender = 'Female' THEN 1 END) as female_students
            FROM students_details_master {where_clause}
        """
        cursor.execute(kpi_query, params)
        kpis = cursor.fetchone()

        def fetch_chart_data(column, order_by='count DESC', limit=10):
            query = f"""
                SELECT {column}, COUNT(*) as count 
                FROM students_details_master {where_clause}
                GROUP BY {column} 
                HAVING {column} IS NOT NULL AND {column} != '' 
                ORDER BY {order_by}
                LIMIT {limit}
            """
            cursor.execute(query, params)
            return cursor.fetchall()
        
        # Fetch chart data
        gender_dist = fetch_chart_data('gender')
        religion_dist = fetch_chart_data('religion')
        blood_group_dist = fetch_chart_data('blood_group')
        category_dist = fetch_chart_data('student_category')
        fathers_occupation_dist = fetch_chart_data('fathers_occupation')
        mothers_occupation_dist = fetch_chart_data('mothers_occupation')
        stream_dist = fetch_chart_data('stream')
        class_dist = fetch_chart_data('class', order_by='class ASC')
        state_dist = fetch_chart_data('state')
        mother_tongue_dist = fetch_chart_data('mother_tongue')
        urban_rural_dist = fetch_chart_data('urban_rural_category')
        previous_school_dist = fetch_chart_data('name_of_the_institution_attended_earlier', limit=8)
        pincode_dist = fetch_chart_data('pin_code')
        city_dist = fetch_chart_data('city')

        # Fixed query for Class-Section-Stream
        css_where_clause = where_clause
        if css_where_clause:
            css_where_clause += " AND class IS NOT NULL AND class != '' AND section IS NOT NULL AND section != '' AND stream IS NOT NULL AND stream != ''"
        else:
            css_where_clause = " WHERE class IS NOT NULL AND class != '' AND section IS NOT NULL AND section != '' AND stream IS NOT NULL AND stream != ''"
        
        css_query = f"""
            SELECT class, section, stream, COUNT(*) as count
            FROM students_details_master {css_where_clause}
            GROUP BY class, section, stream
            ORDER BY count DESC
            LIMIT 15
        """
        cursor.execute(css_query, params)
        class_section_stream_dist = cursor.fetchall()

        # Fixed age query
        age_where_clause = where_clause
        if age_where_clause:
            age_where_clause += " AND date_of_birth IS NOT NULL"
        else:
            age_where_clause = " WHERE date_of_birth IS NOT NULL"
            
        age_query = f"""
            SELECT CASE
                WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) < 18 THEN 'Under 18'
                WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) BETWEEN 18 AND 20 THEN '18-20'
                WHEN TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) BETWEEN 21 AND 23 THEN '21-23'
                ELSE 'Over 23' END AS age_group, COUNT(*) as count
            FROM students_details_master {age_where_clause}
            GROUP BY age_group ORDER BY age_group
        """
        cursor.execute(age_query, params)
        age_dist = cursor.fetchall()

        return {
            'kpis': kpis, 'genderDistribution': gender_dist, 'religionDistribution': religion_dist,
            'bloodGroupDistribution': blood_group_dist, 'categoryDistribution': category_dist,
            'fathersOccupationDistribution': fathers_occupation_dist, 'mothersOccupationDistribution': mothers_occupation_dist,
            'streamDistribution': stream_dist, 'classDistribution': class_dist,
            'stateDistribution': state_dist, 'ageDistribution': age_dist,
            'motherTongueDistribution': mother_tongue_dist, 'urbanRuralDistribution': urban_rural_dist,
            'previousSchoolDistribution': previous_school_dist,
            'classSectionStreamDistribution': class_section_stream_dist,
            'pincodeDistribution': pincode_dist,
            'cityDistribution': city_dist
        }
    except Exception as e:
        print(f"Error in get_student_dashboard_data: {str(e)}")
        raise
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()

def get_filtered_student_list(filters, is_full_list=False):
    db_conn = None
    cursor = None
    try:
        db_conn = get_db_connection()
        cursor = db_conn.cursor(dictionary=True)
        where_clause, params = _build_where_clause(filters)
        
        limit_clause = "" if is_full_list else "LIMIT 100"
        
        if is_full_list:
            query = f"SELECT * FROM students_details_master {where_clause} ORDER BY student_name {limit_clause}"
        else:
            query = f"""
                SELECT master_id, student_reference_id, student_name, institution_code, 
                       student_category, admission_date, gender, mobile_number 
                FROM students_details_master {where_clause} ORDER BY student_name {limit_clause}
            """
        
        cursor.execute(query, params)
        return cursor.fetchall()
    except Exception as e:
        print(f"Error in get_filtered_student_list: {str(e)}")
        raise
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()

def get_student_details_with_fees(student_identifier, identifier_type="student_reference_id"):
    """
    Fetch complete student details with all fields from the database
    """
    try:
        print(f"DEBUG: Looking for student with {identifier_type} = {student_identifier}")
        
        db_conn = get_db_connection()
        cursor = db_conn.cursor(dictionary=True)
        
        # Query to get ALL fields from the students_details_master table
        query = f"""
            SELECT 
                master_id, student_reference_id, institution_code, admission_no, 
                admission_date, admission_feepayment_time, class, section, stream, 
                batch_year, admission_scheme, pr_no, roll_number, student_name, 
                gender, student_category, date_of_birth, religion, blood_group, 
                email_address, full_address, city, state, pin_code, mobile_number, 
                alt_mobile_number, fathers_mobile_number, mothers_mobile_number, 
                fathers_name, fathers_occupation, mothers_name, mothers_occupation, 
                fathers_occupation_category, mothers_occupation_category, nationality, 
                mother_tongue, name_of_the_institution_attended_earlier, 
                passsing_percentage, board_name, passing_year, xii_stream, 
                xii_max_marks, xii_marks_obtained, xii_sub_combination, 
                xii_passing_class, pwd_category_and_Percentage, urban_rural_category, 
                created_at, is_active, updated_at, uploaded_file_id
            FROM students_details_master 
            WHERE {identifier_type} = %s
        """
        
        cursor.execute(query, (student_identifier,))
        student_data = cursor.fetchone()
        
        if student_data:
            print(f"DEBUG: Found student: {student_data['student_name']}")
            # Also fetch fee information if needed
            fee_query = """
                SELECT fees_trans_id, fees_paid_date, amt_paid, tot_amt, 
                       payment_status, payment_mode, installment_no
                FROM fees_transaction 
                WHERE student_reference_id = %s OR master_id = %s
                ORDER BY fees_paid_date DESC
            """
            cursor.execute(fee_query, (student_data.get('student_reference_id'), student_data.get('master_id')))
            fees_data = cursor.fetchall()
            
            return {'details': student_data, 'fees': fees_data}
        else:
            print(f"DEBUG: No student found with {identifier_type} = {student_identifier}")
            return None
            
    except Exception as e:
        print(f"CRITICAL ERROR in get_student_details_with_fees: {str(e)}")
        return None
    finally:
        if cursor: 
            cursor.close()
        if db_conn and db_conn.is_connected(): 
            db_conn.close()

def get_distinct_filter_values(column_name):
    db_conn = None
    cursor = None
    try:
        db_conn = get_db_connection()
        cursor = db_conn.cursor(dictionary=True)
        query = f"SELECT DISTINCT {column_name} FROM students_details_master WHERE {column_name} IS NOT NULL AND {column_name} != '' ORDER BY {column_name}"
        cursor.execute(query)
        return cursor.fetchall()
    except Exception as e:
        print(f"Error in get_distinct_filter_values: {str(e)}")
        raise
    finally:
        if cursor: cursor.close()
        if db_conn and db_conn.is_connected(): db_conn.close()

def export_students_to_excel(students):
    df = pd.DataFrame(students)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Students')
        for column in df:
            column_width = max(df[column].astype(str).map(len).max(), len(column))
            col_idx = df.columns.get_loc(column)
            writer.sheets['Students'].set_column(col_idx, col_idx, column_width + 2)
    output.seek(0)
    return output