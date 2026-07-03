import pandas as pd
import os
import streamlit as st

def get_excel_path():
    """Returns the path to the Excel data file."""
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "csm_company_mappings (14).xlsx")

def load_data(filepath):
    """
    Loads Excel data, handles duplicate column names, cleans values.
    Uses file modification time to auto-refresh when file changes.
    """
    if not os.path.exists(filepath):
        return pd.DataFrame()
    
    try:
        df = pd.read_excel(filepath, engine="openpyxl")
    except Exception as e:
        st.error(f"Error reading Excel file: {e}")
        return pd.DataFrame()
    
    # Standardize column names (handle duplicates in original headers)
    clean_columns = [
        "id", "legalName", "aliasBrand", "product", 
        "csm_name_1", "csm_contact_1", "csm_email_1", 
        "csm_name_2", "csm_email_2", "csm_contact_2", 
        "lead_name", "lead_contact", "lead_email"
    ]
    
    # Only rename up to the number of columns we have
    num_cols = min(len(df.columns), len(clean_columns))
    rename_map = {df.columns[i]: clean_columns[i] for i in range(num_cols)}
    df = df.rename(columns=rename_map)
    
    # Convert all to string and clean
    for col in df.columns:
        df[col] = df[col].fillna("").astype(str).str.strip()
        # Remove float artifacts like ".0"
        df[col] = df[col].apply(lambda x: x.rstrip('0').rstrip('.') if x.replace('.','',1).isdigit() else x)
        # Clean junk placeholders
        if col in ["csm_name_1", "csm_email_1", "csm_name_2", "csm_email_2", "lead_name", "lead_email"]:
            df[col] = df[col].apply(lambda x: "" if x in ["0", "1"] else x)
        if col in ["csm_contact_1", "csm_contact_2", "lead_contact"]:
            df[col] = df[col].apply(lambda x: "" if x in ["0", "1"] else x)
    
    return df

def save_data(df, filepath):
    """Saves dataframe back to Excel with original column headers."""
    original_headers = [
        "id", "legalName", "aliasBrand", "product", 
        "CSM Name 1", "CSM Contact", "CSM EmailId", 
        "CSM Name 2", "CSM EmailID", "CSM Contact", 
        "leadName", "leadName Contact", "lead EmailID"
    ]
    clean_columns = [
        "id", "legalName", "aliasBrand", "product", 
        "csm_name_1", "csm_contact_1", "csm_email_1", 
        "csm_name_2", "csm_email_2", "csm_contact_2", 
        "lead_name", "lead_contact", "lead_email"
    ]
    
    df_save = df.copy()
    rename_map = {c: o for c, o in zip(clean_columns, original_headers) if c in df_save.columns}
    df_save = df_save.rename(columns=rename_map)
    df_save.to_excel(filepath, index=False, engine="openpyxl")
