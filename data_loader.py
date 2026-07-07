import pandas as pd
import os
import streamlit as st

def get_excel_path():
    """Returns the path to the Excel data file."""
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "csm_company_mappings (14).xlsx")

def load_data(filepath):
    """Loads Excel data, handles column mapping, cleans values."""
    if not os.path.exists(filepath):
        return pd.DataFrame()
    
    try:
        df = pd.read_excel(filepath, engine="openpyxl")
    except Exception as e:
        st.error(f"Error reading Excel file: {e}")
        return pd.DataFrame()
    
    # Standardize column names (handles original columns + new Slack columns)
    clean_columns = [
        "id", "legalName", "aliasBrand", "product", 
        "csm_name_1", "csm_contact_1", "csm_email_1", 
        "csm_name_2", "csm_email_2", "csm_contact_2", 
        "lead_name", "lead_contact", "lead_email",
        "csm_slack_1", "csm_slack_2"
    ]
    
    num_cols = min(len(df.columns), len(clean_columns))
    rename_map = {df.columns[i]: clean_columns[i] for i in range(num_cols)}
    df = df.rename(columns=rename_map)
    
    # Clean up empty spaces and floats
    for col in df.columns:
        df[col] = df[col].fillna("").astype(str).str.strip()
        df[col] = df[col].apply(lambda x: x.rstrip('0').rstrip('.') if x.replace('.','',1).isdigit() else x)
        
        # Clean placeholders
        if col in ["csm_name_1", "csm_email_1", "csm_name_2", "csm_email_2", "lead_name", "lead_email", "csm_slack_1", "csm_slack_2"]:
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
        "leadName", "leadName Contact", "lead EmailID",
        "CSM Slack ID", "CSM 2 Slack ID"
    ]
    clean_columns = [
        "id", "legalName", "aliasBrand", "product", 
        "csm_name_1", "csm_contact_1", "csm_email_1", 
        "csm_name_2", "csm_email_2", "csm_contact_2", 
        "lead_name", "lead_contact", "lead_email",
        "csm_slack_1", "csm_slack_2"
    ]
    
    df_save = df.copy()
    rename_map = {c: o for c, o in zip(clean_columns, original_headers) if c in df_save.columns}
    df_save = df_save.rename(columns=rename_map)
    df_save.to_excel(filepath, index=False, engine="openpyxl")

def lookup_slack_id_by_email(email, bot_token):
    """Queries Slack API to lookup a user ID by email address."""
    import urllib.request
    import urllib.parse
    import json
    
    if not email or not bot_token:
        return None
        
    url = f"https://slack.com/api/users.lookupByEmail?email={urllib.parse.quote(email)}"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {bot_token}")
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            data = json.loads(res_body)
            if data.get("ok"):
                return data["user"]["id"]
    except Exception as e:
        pass
    return None

