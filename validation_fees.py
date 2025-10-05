"""
This module contains a helper function for validating and preparing fees data
from the staging table for insertion into the master table.
"""
from datetime import datetime, date
import re

# phone number validation function
def _validate_and_standardize_phone_number(phone_number_value, field_name):
    errors = []
    standardized_number = None
    if phone_number_value:
        try:
            # This handles both '7709595126.0' (string) and 770959126.0 (float) converting to float first, then to an integer.
            phone_number_value = int(float(phone_number_value))
        except (ValueError, TypeError):
            pass

        cleaned_number = re.sub(r'\D', '', str(phone_number_value))
        phone_regex = r'^[6789]\d{9}$'
        if re.match(phone_regex, cleaned_number):
            standardized_number = int(cleaned_number)
        else:
            errors.append(f"Invalid {field_name.replace('_', ' ').title()}: '{phone_number_value}'. Must be a 10-digit number starting with 6, 7, 8, or 9.")
            
    return standardized_number, errors

def _validate_and_prepare_fees_data(cursor, record, uploaded_file_id, master_table, academic_year, academic_quarter, institution_code):
    """
    Validates a fees record and prepares the necessary SQL query and values
    for insertion into the master table, with institute-specific rules.

    Args:
        cursor: The database cursor object.
        record (dict): The dictionary representing a single row from the staging table.
        uploaded_file_id (int): The ID of the uploaded file.
        master_table (str): The name of the master fees table.
        academic_year (str): The academic year.
        academic_quarter (str): The academic quarter.
        institution_code (str): The code of the institute to determine the validation rules.

    Returns:
        tuple: A tuple containing (master_insert_query, values, validation_errors).
               Returns (None, None, list) if validation fails.
    """
    validation_errors = []
    
    # --- Common validation: Check for existence of the record and file ID ---
    if record is None or not uploaded_file_id:
        validation_errors.append("Error: Found an empty or invalid record or missing uploaded_file_id.")
        return None, None, validation_errors
        
    # --- SDCCE and GRKCL Fees Validation ---
    if institution_code == 'SDCCE' or institution_code == 'GRKCL':
        # 1. Define mandatory fields for SDCCE fees
        mandatory_fields = ['student', 'standard_course']
        
        for field in mandatory_fields:
            if not record.get(field):
                validation_errors.append(f"{field.replace('_', ' ').title()} is a mandatory field for SDCCE.")
        
        if validation_errors:
            return None, None, validation_errors
        
        # 2. Validate and standardize the student name to accept special characters
        student_name_raw = record.get('student')
        standardized_student_name = None
        if not student_name_raw:
            validation_errors.append("Student name is a mandatory field.")
        else:
            # Check for non-alphabetic characters (excluding spaces, hyphens, and apostrophes)
            # This allows names like "Jean-Pierre" or "O'Malley"
            if not isinstance(student_name_raw, str) or re.search(r'[^a-zA-Z\s\'-.]', student_name_raw):
                validation_errors.append(f"Invalid student name: {student_name_raw}. It must contain only characters, spaces, hyphens, or apostrophes.")
            else:
                standardized_student_name = ' '.join(student_name_raw.strip().split()).title()

        standard_course= record.get('standard_course')

        fees_id_raw = record.get('fees_id')
        fees_id = None
        if not fees_id_raw:
            validation_errors.append("Fees Id is a mandatory field.")
        else:
            try:
                # Corrected: Convert to float first to handle the .0
                fees_id = int(float(fees_id_raw))
                if fees_id <= 0:
                    validation_errors.append(f"Invalid Fees Id: '{fees_id_raw}'. Must be a positive integer.")
            except (ValueError, TypeError):
                validation_errors.append(f"Invalid Fees Id: '{fees_id_raw}'. Must be a valid integer.")

        fees_schedule_id_raw = record.get('fees_schedule_id')
        fees_schedule_id = None
        if not fees_schedule_id_raw:
            fees_schedule_id = None
        else:
            try:
                # Corrected: Convert to float first to handle the .0
                fees_schedule_id = int(float(fees_schedule_id_raw))
                if fees_schedule_id <= 0:
                    validation_errors.append(f"Invalid Fees Schedule Id: '{fees_schedule_id_raw}'. Must be a positive integer.")
            except (ValueError, TypeError):
                validation_errors.append(f"Invalid Fees Schedule Id: '{fees_schedule_id_raw}'. Must be a valid integer.")

        email_raw = record.get('e_mail_address')
        # Corrected: A more robust regex that handles multi-part domains like .edu.in
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]{2,}$'
        if not email_raw:
            standardized_email =None
        else:
            email_raw = email_raw.strip()
            if re.match(email_regex, email_raw):
                standardized_email = email_raw.lower()
            else:
                validation_errors.append(f"Invalid email format: '{email_raw}'.")

        mobile_number_raw = record.get('mobile_number')
        standardized_mobile_number = None
        standardized_mobile_number, mobile_errors = _validate_and_standardize_phone_number(mobile_number_raw, 'Mobile Number')
        validation_errors.extend(mobile_errors)

        # Validate and standardize 'Division'
        division_raw = record.get('division')
        standardized_division = None
        division_mapping = {'semester i and ii': '1st Year',
                              'semester iii and iv': '2nd Year','semester v and vi': '3rd Year',}
        if not division_raw:
            standardized_division = None
        else:
            normalized_division = ' '.join(division_raw.strip().split()).lower()
            if normalized_division in division_mapping:
                standardized_division = division_mapping[normalized_division]
            else:
                standardized_division = ' '.join(division_raw.strip().split()).title()

        standardized_registration_code=record.get('registration_code')
        
        # Validate and standardize 'Fee Head'
        fee_head_raw = record.get('fee_head')
        standardized_fee_head = None
        
        # Helper function to get the correct ordinal suffix
        def get_ordinal_suffix(n):
            if 10 <= n % 100 <= 20:
                return 'th'
            else:
                return {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')

        if not fee_head_raw:
            validation_errors.append("Fee Head is a mandatory field.")
        else:
            normalized_fee_head = ' '.join(fee_head_raw.strip().split()).lower()

            # Roman numeral mapping
            roman_numerals = {
                'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
                'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10
            }

            # Check for 'semester' or 'full fees' first
            if 'semester' in normalized_fee_head or 'full' in normalized_fee_head:
                standardized_fee_head = "Full Fees"
            else:
                # Regex to match full Roman numerals
                roman_match = re.search(r'\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b', normalized_fee_head)
                
                # Regex for ordinal numbers (e.g., 1st, 2nd)
                ordinal_match = re.search(r'(\d+)(st|nd|rd|th)', normalized_fee_head)

                # Regex for cardinal numbers after "installment" (e.g., Installment 1)
                cardinal_match = re.search(r'installment\s+(\d+)', normalized_fee_head)

                if roman_match:
                    roman_numeral = roman_match.group(1).lower()
                    installment_number = roman_numerals.get(roman_numeral)
                    if installment_number:
                        suffix = get_ordinal_suffix(installment_number)
                        standardized_fee_head = f"{installment_number}{suffix} installment"
                    else:
                        standardized_fee_head = fee_head_raw.strip().title()
                
                elif ordinal_match:
                    index = int(ordinal_match.group(1))
                    suffix = get_ordinal_suffix(index)
                    standardized_fee_head = f"{index}{suffix} installment"

                elif cardinal_match:
                    index = int(cardinal_match.group(1))
                    suffix = get_ordinal_suffix(index)
                    standardized_fee_head = f"{index}{suffix} installment"
                    
                else:
                    # Final fallback for any other format
                    standardized_fee_head = fee_head_raw.strip().title()

        # Validate 'Due Date'
        due_date_raw = record.get('due_date')
        standardized_due_date = None
        if not due_date_raw:
            standardized_due_date = None
        else:
            try:
                parsed_date = datetime.strptime(due_date_raw.strip(), '%d/%m/%Y').date()
                standardized_due_date = parsed_date.strftime('%Y-%m-%d')
            except (ValueError, TypeError):validation_errors.append(f"Invalid Due Date: '{due_date_raw}'. Expected format is DD/MM/YYYY.")

        # Validate 'Fees Paid Date'
        fees_paid_date_raw = record.get('fees_paid_date')
        standardized_fees_paid_date = None
        current_date = date.today() 
        if fees_paid_date_raw and str(fees_paid_date_raw).strip():
            try:
                parsed_date = datetime.strptime(str(fees_paid_date_raw).strip(), '%d/%m/%y').date()
                # Check that the fees paid date is not in the future
                if parsed_date > current_date:
                    validation_errors.append(f"Fees Paid Date cannot be in the future: '{fees_paid_date_raw}'.")
                else:
                    # Standardize to YYYY-MM-DD format
                    standardized_fees_paid_date = parsed_date.strftime('%Y-%m-%d')
            except (ValueError, TypeError):
                validation_errors.append(f"Invalid Fees Paid Date: '{fees_paid_date_raw}'. Expected format is DD/MM/YY.")

        # Validate and Standardize 'Payment Mode'
        payment_mode_raw = record.get('payment_mode')
        standardized_payment_mode = None

        # Only process if a value exists. Blanks will result in None.
        if payment_mode_raw and str(payment_mode_raw).strip():
            # Normalize the string for consistent matching
            normalized_mode = str(payment_mode_raw).strip().upper()

            # Use 'in' to catch variations like 'RUPAY DEBIT CARD'
            if 'DEBIT CARD' in normalized_mode:
                standardized_payment_mode = 'DEBIT CARD'
            elif 'CREDIT CARD' in normalized_mode:
                standardized_payment_mode = 'CREDIT CARD'
            elif 'BANK' in normalized_mode:
                standardized_payment_mode = 'BANK'
            elif 'UPI' in normalized_mode:
                standardized_payment_mode = 'UPI'
            # Ignore placeholder values silently
            elif normalized_mode in ('PAYMENT MODE',):
                standardized_payment_mode = None
            # Any other value is considered an error
            else:
                validation_errors.append(f"Invalid or unmapped Payment Mode: '{payment_mode_raw}'.")

            cheque_dd_no = record.get('cheque_dd_no')
            if not cheque_dd_no or cheque_dd_no=='NULL':
                cheque_dd_no = 'Not applicable'


        # Validate 'Settlement Date'
        settlement_date_raw = record.get('settlement_date')
        standardized_settlement_date = None
        
        # Get the current date for logical validation
        current_date = date.today()

        # Process only if a value is present
        if settlement_date_raw and str(settlement_date_raw).strip():
            date_str = str(settlement_date_raw).strip()
            try:
                # Attempt to parse the string to ensure it's a valid date in YYYY-MM-DD format
                parsed_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                # Optional but recommended: Check that the settlement date is not in the future
                if parsed_date > current_date:
                    validation_errors.append(f"Settlement Date cannot be in the future: '{date_str}'.")
                else:
                    # If validation passes, the string is already in the desired format
                    standardized_settlement_date = date_str
            except (ValueError, TypeError):
                # This block catches both invalid formats and non-existent dates (e.g., 2025-02-30)
                validation_errors.append(f"Invalid Settlement Date: '{date_str}'. Must be a valid date in YYYY-MM-DD format.")
                
        standardized_paid_amount = None
        paid_amount_raw = record.get('paid_amount')
        if paid_amount_raw is not None:
            try:
                standardized_paid_amount = float(paid_amount_raw)
            except (ValueError, TypeError):
                validation_errors.append(f"Invalid Paid Amount: '{paid_amount_raw}' for student '{standardized_student_name}'.")

        # 3. Check for an exact duplicate row in the master table for SDCCE
        # NULL-safe operator '<=>'
        duplicate_check_query = f"""
            SELECT 1 FROM {master_table}
            WHERE institution_code <=> %s
              AND student_name <=> %s
              AND installment_no <=> %s
              AND amount_paid <=> %s
              AND fees_paid_date <=> %s

        """
        values_for_check = (institution_code,
            standardized_student_name,
            standardized_fee_head,
            standardized_paid_amount, 
            standardized_fees_paid_date)
        
        cursor.execute(duplicate_check_query, values_for_check)
        
        result = cursor.fetchall()
        if result:
            validation_errors.append(f"Duplicate record found for student '{standardized_student_name}' in course '{standard_course}'.")
            return None, None, validation_errors
        
        # 4. Prepare the insertion query and values for SDCCE
        master_insert_query = f"""
            INSERT INTO {master_table} (uploaded_file_id,fees_table_ref_id, institution_code, institute_name,branch_name,student_name,course_name,fees_id,email_address,mobile_no,division_name,registration_code,qfix_ref_no,payment_status,installment_no,total_amt,amount_paid,remaining_amount,fees_paid_date,due_date,transaction_id,fees_category,payment_option,payment_mode,payment_details,cheque_dd_no,payment_reference_details,settlement_date,bank_reference_no,late_payment_charges,refund_amount,refund_date,refund_status,rms_secondary_school_76503022,sdcce_commerce_economics_76502948,sdcce_mcom_76502950,sdcce_bba_76502953,sdcce_bcom_nsa_76502893,sdcce_pgdft_76078365,sdcce_b_voc_76502967,

            tuition_fees,university_registration_fees,laboratory_fees,library_fees,gymkhana_fees,university_administration_fees,library_id_card_etc,computer_lab_fees,information_technology_fees,iaims_fees_dhe,other_fees,student_aid_fees,library_deposit,caution_money_deposit,development_fees,examination_fees,pta_fees,iams_fees,alumni_registration_fees,academic_restructuring_and_development_fees,magazine_academic_diary_placement_brochure,id_card_fees,iaims_fees)

            VALUES (%s, %s,%s, %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """
        values = (
            uploaded_file_id,'fees_table_ref_id', institution_code, record.get('institute') ,record.get('branch'),standardized_student_name,standard_course,fees_id,standardized_email,standardized_mobile_number,standardized_division,standardized_registration_code,record.get('qfix_reference_number'),record.get('payment_status'),standardized_fee_head,record.get('total_amount'),standardized_paid_amount ,record.get('remaining_amount'),standardized_fees_paid_date,standardized_due_date,record.get('payment_gateway_transaction_id'),record.get('fees_category'), record.get('payment_option'),standardized_payment_mode,record.get('payment_details'),cheque_dd_no,record.get('payment_reference_details'),standardized_settlement_date,record.get('bank_reference_no'),record.get('late_payment_charges'),record.get('refund_amount'),record.get('refund_date'),record.get('refund_status'),record.get('rms_secondary_school_76503022'),record.get('sdcce_commerce_economics_76502948'),record.get('sdcce_mcom_76502950'),record.get('sdcce_bba_76502953'),record.get('sdcce_bcom_nsa_76502893'),record.get('sdcce_pgdft_76078365'),record.get('sdcce_b_voc_76502967'),
            #fee distribution fields
            record.get('tuition_fees'),record.get('university_registration_fees'),record.get('laboratory_fees'),record.get('library_fees'),record.get('gymkhana_fees'),record.get('university_administration_fees'),record.get('library_id_card_etc'),record.get('computer_lab_fees'),record.get('information_technology_fees'),record.get('iaims_fees_dhe'),record.get('other_fees'),record.get('student_aid_fees'),record.get('library_deposit'),record.get('caution_money_deposit'),record.get('development_fees'),record.get('examination_fees'),record.get('pta_fees'),
            record.get('iams_fees'),record.get('alumni_registration_fees'),record.get('academic_restructuring_and_development_fees'),record.get('magazine_academic_diary_placement_brochure'),record.get('id_card_fees'),record.get('iaims_fees')
            )
        
        return master_insert_query, values, validation_errors
        
    # --- RMS Fees Validation ---
    elif institution_code == 'RMS':
        # 1. Define mandatory fields for RMS fees
        mandatory_fields = ['student', 'standard_course']
        
        for field in mandatory_fields:
            if not record.get(field):
                validation_errors.append(f"{field.replace('_', ' ').title()} is a mandatory field for RMS.")
        
        if validation_errors:
            return None, None, validation_errors

         # 2. Validate and standardize the student name to accept special characters
        student_name_raw = record.get('student')
        standardized_student_name = None
        if not student_name_raw:
            validation_errors.append("Student name is a mandatory field.")
        else:
            # Check for non-alphabetic characters (excluding spaces, hyphens, and apostrophes)
            # This allows names like "Jean-Pierre" or "O'Malley"
            if not isinstance(student_name_raw, str) or re.search(r'[^a-zA-Z\s\'-.]', student_name_raw):
                validation_errors.append(f"Invalid student name: {student_name_raw}. It must contain only characters, spaces, hyphens, or apostrophes.")
            else:
                standardized_student_name = ' '.join(student_name_raw.strip().split()).title()

        email_raw = record.get('e_mail_address')
        # Corrected: A more robust regex that handles multi-part domains like .edu.in
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]{2,}$'
        if not email_raw:
            standardized_email =None
        else:
            email_raw = email_raw.strip()
            if re.match(email_regex, email_raw):
                standardized_email = email_raw.lower()
            else:
                validation_errors.append(f"Invalid email format: '{email_raw}'.")

        mobile_number_raw = record.get('mobile_number')
        standardized_mobile_number = None
        standardized_mobile_number, mobile_errors = _validate_and_standardize_phone_number(mobile_number_raw, 'Mobile Number')
        validation_errors.extend(mobile_errors)

        # Validate and Standardize 'Payment Mode'
        payment_mode_raw = record.get('payment_mode')
        standardized_payment_mode = None

        # Only process if a value exists. Blanks will result in None.
        if payment_mode_raw and str(payment_mode_raw).strip():
            # Normalize the string for consistent matching
            normalized_mode = str(payment_mode_raw).strip().upper()

            # Use 'in' to catch variations like 'RUPAY DEBIT CARD'
            if 'DEBIT CARD' in normalized_mode:
                standardized_payment_mode = 'DEBIT CARD'
            elif 'CREDIT CARD' in normalized_mode:
                standardized_payment_mode = 'CREDIT CARD'
            elif 'BANK' in normalized_mode:
                standardized_payment_mode = 'BANK'
            elif 'UPI' in normalized_mode:
                standardized_payment_mode = 'UPI'
            elif 'CASH' in normalized_mode:
                standardized_payment_mode = 'CASH'
            elif 'CHEQUE' in normalized_mode:
                standardized_payment_mode = 'CHEQUE'
            # Ignore placeholder values silently
            elif normalized_mode in ('PAYMENT MODE',):
                standardized_payment_mode = None
            # Any other value is considered an error
            else:
                validation_errors.append(f"Invalid or unmapped Payment Mode: '{payment_mode_raw}'.")

        cheque_dd_no = record.get('cheque_dd_no')
        if not cheque_dd_no or cheque_dd_no=='NULL':
            cheque_dd_no = 'Not applicable'

        # Validate 'Fees Paid Date'
        fees_paid_date_raw = record.get('fees_paid_date')
        standardized_fees_paid_date = None
        current_date = date.today()  # Ensure current_date is defined

        if fees_paid_date_raw and str(fees_paid_date_raw).strip():
            date_str = str(fees_paid_date_raw).strip()
            parsed_date = None

            # Attempt to parse multiple date formats
            try:
                # Attempt 1: Handle 'YYYY-MM-DD HH:MM:SS' or 'YYYY-MM-DD'
                # We split by space to remove the timestamp if it exists
                date_only_str = date_str.split(' ')[0]
                parsed_date = datetime.strptime(date_only_str, '%Y-%m-%d').date()
            except (ValueError, TypeError):
                # Attempt 2: If the first format fails, try 'DD/MM/YY'
                try:
                    parsed_date = datetime.strptime(date_str, '%d/%m/%y').date()
                except (ValueError, TypeError):
                    # If both attempts fail, add an error
                    validation_errors.append(f"Invalid Fees Paid Date: '{fees_paid_date_raw}'. Expected format is YYYY-MM-DD or DD/MM/YY.")

            # If a date was successfully parsed, perform logical checks and standardize it
            if parsed_date:
                # Check that the fees paid date is not in the future
                if parsed_date > current_date:
                    validation_errors.append(f"Fees Paid Date cannot be in the future: '{fees_paid_date_raw}'.")
                else:
                    # Standardize to YYYY-MM-DD format
                    standardized_fees_paid_date = parsed_date.strftime('%Y-%m-%d')


        # Validate 'Settlement Date'
        settlement_date_raw = record.get('settlement_date')
        standardized_settlement_date = None
        
        # Get the current date for logical validation
        # Using the current time to avoid any timezone issues with the check
        current_date = datetime.now().date()

        # Process only if a value is present
        if settlement_date_raw and str(settlement_date_raw).strip():
            # --- THIS IS THE CORRECTED LINE ---
            # Trim whitespace and then split the string by the space to remove the time part.
            # '2025-05-01 00:00:00' becomes '2025-05-01'
            date_str = str(settlement_date_raw).strip().split(' ')[0]
            
            try:
                # Attempt to parse the string to ensure it's a valid date in YYYY-MM-DD format
                parsed_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                
                # Optional but recommended: Check that the settlement date is not in the future
                if parsed_date > current_date:
                    validation_errors.append(f"Settlement Date cannot be in the future: '{date_str}'.")
                else:
                    # If validation passes, the string is now guaranteed to be in the desired format
                    standardized_settlement_date = date_str
            except (ValueError, TypeError):
                # This block catches both invalid formats and non-existent dates (e.g., 2025-02-30)
                validation_errors.append(f"Invalid Settlement Date: '{date_str}'. Must be a valid date in YYYY-MM-DD format.")

        fee_head_raw = record.get('fee_head')
        standardized_fee_head = None # Default to None if empty

        if fee_head_raw and str(fee_head_raw).strip():
            # Normalize for a case-insensitive check
            normalized_fee_head = str(fee_head_raw).strip().lower()

            # Check if the string contains "admission fees"
            if 'admission fees' in normalized_fee_head:
                standardized_fee_head = 'Full Fees'
            else:
                # Fallback for any other value, just clean and title-case it
                standardized_fee_head = fee_head_raw.strip().title()
                

        # 3. Check for an exact duplicate row in the master table for RMS
        duplicate_check_query = f"""
            SELECT 1 FROM {master_table}
            WHERE institution_code <=> %s
              AND student_name <=> %s
              AND course_name <=> %s
              AND installment_no <=> %s
              AND amount_paid <=> %s
              AND fees_paid_date <=> %s
        """
        values_for_check = (
            institution_code,
            standardized_student_name,
            record.get('standard_course'),
            standardized_fee_head,
            record.get('paid_amount'),
            standardized_fees_paid_date)
        cursor.execute(duplicate_check_query, values_for_check)
        
        result = cursor.fetchall()
        if result:
            validation_errors.append(f"Duplicate record found for student: '{standardized_student_name}'.")
            return None, None, validation_errors
        
        # 4. Prepare the insertion query and values for RMS
        master_insert_query = f"""
            INSERT INTO {master_table} (fees_table_ref_id,uploaded_file_id, institution_code,institute_name,branch_name,student_name,email_address,mobile_no,course_name,registration_code,qfix_ref_no,payment_status,installment_no,total_amt,late_payment_charges,amount_paid,remaining_amount,fees_paid_date,due_date,fees_id,transaction_id,bank_reference_no,payment_option,payment_mode,payment_reference_details,payment_details,settlement_date,division_name,refund_amount,refund_date,refund_status,fees_category,cheque_dd_no,rms_secondary_school_76503022,term_fees,pupils_fund,examination_fees,general_deposit,enrolment_fee,laboratory_deposit,laboratory_fee)
            VALUES (%s,%s, %s, %s, %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """
        values = (record.get('registration_code'),uploaded_file_id, institution_code, record.get('institute'), record.get('branch'),standardized_student_name,standardized_email,standardized_mobile_number,record.get('standard_course'),record.get('registration_code'),record.get('qfix_reference_number'),record.get('payment_status'),standardized_fee_head,record.get('total_amount'),record.get('late_payment_charges'),record.get('paid_amount'),record.get('remaining_amount'),standardized_fees_paid_date,record.get('due_date'),record.get('fees_id'),record.get('payment_gateway_transaction_id'),record.get('bank_reference_no'),record.get('payment_option'),standardized_payment_mode,record.get('payment_reference_details'),record.get('payment_details'),record.get('settlement_date'),record.get('division'),record.get('refund_amount'),record.get('refund_date'),record.get('refund_status'),record.get('fees_category'),cheque_dd_no,record.get('rms_secondary_school_76503022'),record.get('term_fees'),record.get('pupils_fund'),record.get('examination_fees'),record.get('general_deposit'),record.get('enrolment_fee'),record.get('laboratory_deposit'),record.get('laboratory_fee') )
        
        return master_insert_query, values, validation_errors

    # --- VVA Fees Validation ---
    elif institution_code == 'VVA':
        # 1. Extract and validate mandatory fields
        mandatory_fields = ['institute','standard_course', 'branch']
        
        for field in mandatory_fields:
            if not record.get(field):
                validation_errors.append(f"{field.capitalize()} is a mandatory field.")

        if not uploaded_file_id:
            validation_errors.append("Uploaded_file_id is a mandatory parameter.")

        if validation_errors:
            return None, None, validation_errors

        # Extract the validated institute name
        institute = record.get('institute')

        # --- Validate and standardize 'branch'---
        branch = record.get('branch')
        standardized_branch = None
        is_pre_primary_branch = False

        if branch:
            standardized_branch = branch.strip().title()
            primary_secondary_branch_types = ["Primary", "Secondary", "Senior Secondary"]
            pre_primary_branch_type = "Pre Primary"
        
            if standardized_branch.startswith(pre_primary_branch_type):
                is_pre_primary_branch = True
                standardized_branch = pre_primary_branch_type
            elif any(b in standardized_branch for b in primary_secondary_branch_types):
                standardized_branch = "Primary Secondary Senior Secondary"
            else:
                validation_errors.append(f"Invalid branch value: '{branch}'. Must be a recognized category like 'Pre Primary' or 'Primary/Secondary'.")

        # --- Validate and standardize the 'standard_course' based on the 'branch' ---
        course = record.get('standard_course')
        standardized_course = None
        
        if course:
            normalized_course = course.strip().upper()
            
            if is_pre_primary_branch:
                pre_primary_mapping = {
                    'NURSERY': 'Nursery',
                    'JUNIOR KG': 'Junior KG',
                    'SENIOR KG': 'Senior KG',
                    'PLAY GROUP':'Play Group',
                }
                if normalized_course in pre_primary_mapping:
                    standardized_course = pre_primary_mapping[normalized_course]
                else:
                    validation_errors.append(f"Invalid course value: '{course}'. For a 'Pre Primary' branch, course must be 'Nursery', 'Junior KG', or 'Senior KG'.")
            else:
                try:
                    course_grade = int(normalized_course)
                    if 1 <= course_grade <= 12:
                        standardized_course = str(course_grade)
                    else:
                        validation_errors.append(f"Invalid course value: '{course}'. For a 'Primary/Secondary' branch, course must be a number from 1 to 12.")
                except ValueError:
                    validation_errors.append(f"Invalid course value: '{course}'. For a 'Primary/Secondary' branch, course must be a number from 1 to 12.")



                 # 2. Validate and standardize the student name to accept special characters
        student_name_raw = record.get('student')
        standardized_student_name = None
        if not student_name_raw:
            validation_errors.append("Student name is a mandatory field.")
        else:
            # Check for non-alphabetic characters (excluding spaces, hyphens, and apostrophes)
            # This allows names like "Jean-Pierre" or "O'Malley"
            if not isinstance(student_name_raw, str) or re.search(r'[^a-zA-Z\s\'-.]', student_name_raw):
                validation_errors.append(f"Invalid student name: {student_name_raw}. It must contain only characters, spaces, hyphens, or apostrophes.")
            else:
                standardized_student_name = ' '.join(student_name_raw.strip().split()).title()

        email_raw = record.get('e_mail_address')
        # Corrected: A more robust regex that handles multi-part domains like .edu.in
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]{2,}$'
        if not email_raw:
            standardized_email =None
        else:
            email_raw = email_raw.strip()
            if re.match(email_regex, email_raw):
                standardized_email = email_raw.lower()
            else:
                validation_errors.append(f"Invalid email format: '{email_raw}'.")

        mobile_number_raw = record.get('mobile_number')
        standardized_mobile_number = None
        standardized_mobile_number, mobile_errors = _validate_and_standardize_phone_number(mobile_number_raw, 'Mobile Number')
        validation_errors.extend(mobile_errors)

        # Validate and Standardize 'Payment Mode'
        payment_mode_raw = record.get('payment_mode')
        standardized_payment_mode = None

        # Only process if a value exists. Blanks will result in None.
        if payment_mode_raw and str(payment_mode_raw).strip():
            # Normalize the string for consistent matching
            normalized_mode = str(payment_mode_raw).strip().upper()

            # Use 'in' to catch variations like 'RUPAY DEBIT CARD'
            if 'DEBIT CARD' in normalized_mode:
                standardized_payment_mode = 'DEBIT CARD'
            elif 'CREDIT CARD' in normalized_mode:
                standardized_payment_mode = 'CREDIT CARD'
            elif 'BANK' in normalized_mode:
                standardized_payment_mode = 'BANK'
            elif 'UPI' in normalized_mode:
                standardized_payment_mode = 'UPI'
            elif 'CASH' in normalized_mode:
                standardized_payment_mode = 'CASH'
            elif 'CHEQUE' in normalized_mode:
                standardized_payment_mode = 'CHEQUE'
            # Ignore placeholder values silently
            elif normalized_mode in ('PAYMENT MODE',):
                standardized_payment_mode = None
            # Any other value is considered an error
            else:
                validation_errors.append(f"Invalid or unmapped Payment Mode: '{payment_mode_raw}'.")

        cheque_dd_no = record.get('cheque_dd_no')
        if not cheque_dd_no or cheque_dd_no=='NULL':
            cheque_dd_no = 'Not applicable'


        # Validate 'Settlement Date'
        settlement_date_raw = record.get('settlement_date')
        standardized_settlement_date = None
        
        # Get the current date for logical validation
        # Using the current time to avoid any timezone issues with the check
        current_date = datetime.now().date()

        # Process only if a value is present
        if settlement_date_raw and str(settlement_date_raw).strip():
            # --- THIS IS THE CORRECTED LINE ---
            # Trim whitespace and then split the string by the space to remove the time part.
            # '2025-05-01 00:00:00' becomes '2025-05-01'
            date_str = str(settlement_date_raw).strip().split(' ')[0]
            
            try:
                # Attempt to parse the string to ensure it's a valid date in YYYY-MM-DD format
                parsed_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                
                # Optional but recommended: Check that the settlement date is not in the future
                if parsed_date > current_date:
                    validation_errors.append(f"Settlement Date cannot be in the future: '{date_str}'.")
                else:
                    # If validation passes, the string is now guaranteed to be in the desired format
                    standardized_settlement_date = date_str
            except (ValueError, TypeError):
                # This block catches both invalid formats and non-existent dates (e.g., 2025-02-30)
                validation_errors.append(f"Invalid Settlement Date: '{date_str}'. Must be a valid date in YYYY-MM-DD format.")

        payment_reference_details=record.get('payment_reference_details')
        if not payment_reference_details or payment_reference_details=='NULL':
                payment_reference_details= 'Not applicable'


        # Validate 'Fees Paid Date'
        fees_paid_date_raw = record.get('fees_paid_date')
        standardized_fees_paid_date = None
        current_date = date.today()  # Ensure current_date is defined

        if fees_paid_date_raw and str(fees_paid_date_raw).strip():
            date_str = str(fees_paid_date_raw).strip()
            parsed_date = None

            # Attempt to parse multiple date formats
            try:
                # Attempt 1: Handle 'YYYY-MM-DD HH:MM:SS' or 'YYYY-MM-DD'
                # We split by space to remove the timestamp if it exists
                date_only_str = date_str.split(' ')[0]
                parsed_date = datetime.strptime(date_only_str, '%Y-%m-%d').date()
            except (ValueError, TypeError):
                # Attempt 2: If the first format fails, try 'DD/MM/YY'
                try:
                    parsed_date = datetime.strptime(date_str, '%d/%m/%y').date()
                except (ValueError, TypeError):
                    # If both attempts fail, add an error
                    validation_errors.append(f"Invalid Fees Paid Date: '{fees_paid_date_raw}'. Expected format is YYYY-MM-DD or DD/MM/YY.")

            # If a date was successfully parsed, perform logical checks and standardize it
            if parsed_date:
                # Check that the fees paid date is not in the future
                if parsed_date > current_date:
                    validation_errors.append(f"Fees Paid Date cannot be in the future: '{fees_paid_date_raw}'.")
                else:
                    # Standardize to YYYY-MM-DD format
                    standardized_fees_paid_date = parsed_date.strftime('%Y-%m-%d')


     # --- Registration Code Standardization ---
        standardized_reg_code = None
        raw_reg_code = record.get('registration_code') #

        # 1. Since it's a key for linking, treat as a mandatory field.
        if raw_reg_code is None or str(raw_reg_code).strip() == '':
            validation_errors.append("Missing mandatory field: Registration Code")
        else:
            cleaned_str = str(raw_reg_code).strip()
            numeric_part = ''# 2. Check for 'pp' prefix (case-insensitive) and extract the numeric part.
            if cleaned_str.lower().startswith('pp'):
                numeric_part = cleaned_str[2:].strip()
            else:numeric_part = cleaned_str # 3. Try to convert the extracted part to a positive integer.
            if numeric_part:
                try:
                    reg_code_int = int(numeric_part)
                    if reg_code_int > 0:standardized_reg_code = reg_code_int
                    else:
                        validation_errors.append(f"Invalid Registration Code: '{raw_reg_code}'. The numeric part must be a positive number.")
                except (ValueError, TypeError):
                    validation_errors.append(f"Invalid Registration Code format: '{raw_reg_code}'. Could not extract a valid number.")
            else:# This case handles an input that was only 'pp' with nothing after it.
                validation_errors.append(f"Invalid Registration Code format: '{raw_reg_code}'. A number must follow the 'pp' prefix.")

        def get_ordinal_suffix(n):
            if 10 <= n % 100 <= 20:
                return 'th'
            else:return {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')

        fee_head_raw = record.get('fee_head')
        standardized_fee_head = None
        
        if fee_head_raw and str(fee_head_raw).strip():
            # Normalize the input to handle extra spaces and case differences
            normalized_fee_head = str(fee_head_raw).strip().lower()
            
            # Use regex to find any sequence of digits in the string
            match = re.search(r'\d+', normalized_fee_head)
            
            if match:
                # If a number is found (e.g., in "Term 1" or "Term-2")
                installment_number = int(match.group(0))
                suffix = get_ordinal_suffix(installment_number)
                standardized_fee_head = f"{installment_number}{suffix} Installment"
            else:
                # Fallback for values that don't contain a number (e.g., "Full Fees")
                standardized_fee_head = fee_head_raw.strip().title()
        
                # Validate 'Due Date'
        due_date_raw = record.get('due_date')
        standardized_due_date = None
        if not due_date_raw:
            standardized_due_date = None
        else:
            try:
                parsed_date = datetime.strptime(due_date_raw.strip(), '%d/%m/%Y').date()
                standardized_due_date = parsed_date.strftime('%Y-%m-%d')
            except (ValueError, TypeError):validation_errors.append(f"Invalid Due Date: '{due_date_raw}'. Expected format is DD/MM/YYYY.")


        # Check for an exact duplicate row in the master table for VVA
        # 3. Check for an exact duplicate row in the master table for RMS
        duplicate_check_query = f"""
            SELECT 1 FROM {master_table}
              WHERE institution_code <=> %s
              AND registration_code <=> %s
              AND course_name <=> %s
              AND installment_no <=> %s
              AND fees_paid_date <=> %s
        """
        values_for_check = (institution_code,record.get('registration_code'),standardized_course,standardized_fee_head,standardized_fees_paid_date)
        cursor.execute(duplicate_check_query, values_for_check)
        
        # FIX 2: Use fetchall() to clear the cursor and prevent "Unread result" error
        result = cursor.fetchall()
        if result:
            validation_errors.append(f"Duplicate record found for registration code: '{record.get('registration_code')}'.")
            return None, None, validation_errors
        
        # Prepare the insertion query and values for VVA
        master_insert_query = f"""
            INSERT INTO {master_table} (fees_table_ref_id,uploaded_file_id, institution_code,institute_name,branch_name,student_name,email_address,mobile_no,course_name,registration_code,qfix_ref_no,payment_status,installment_no,total_amt,late_payment_charges,amount_paid,remaining_amount,fees_paid_date,due_date,fees_id,transaction_id,bank_reference_no,payment_option,payment_mode,payment_reference_details,payment_details,settlement_date,division_name,refund_amount,refund_date,refund_status,fees_category,cheque_dd_no,vva_pre_primary_online_offline_live_account,vvm_online_offline_live_account,
            tuition_fees,term_fees,activity_fees,admission_fees,registration_fees,development_fund,refundable_deposit)
            VALUES (%s, %s,%s, %s, %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """
        values = (standardized_reg_code,uploaded_file_id, institution_code, record.get('institute'), record.get('branch'),standardized_student_name,standardized_email,standardized_mobile_number,standardized_course,record.get('registration_code'),record.get('qfix_reference_number'),record.get('payment_status'),standardized_fee_head ,record.get('total_amount'),record.get('late_payment_charges'),record.get('paid_amount'),record.get('remaining_amount'),standardized_fees_paid_date,standardized_due_date,record.get('fees_id'),record.get('payment_gateway_transaction_id'),record.get('bank_reference_no'),record.get('payment_option'),standardized_payment_mode,payment_reference_details,record.get('payment_details'),record.get('settlement_date'),record.get('division'),record.get('refund_amount'),record.get('refund_date'),record.get('refund_status'),record.get('fees_category'),cheque_dd_no,record.get('vva_pre_primary_online_offline_live_account'),record.get('vvm_online_offline_live_account'),record.get('tuition_fees'),record.get('term_fees'),record.get('activity_fees'),record.get('admission_fees'),record.get('registration_fees'),record.get('development_fund'),record.get('refundable_deposit'))
        
        return master_insert_query, values, validation_errors
        
    # --- Catch-all for other institutes ---
    else:
        validation_errors.append(f"No specific fees validation rules found for institution code: {institution_code}.")
        return None, None, validation_errors