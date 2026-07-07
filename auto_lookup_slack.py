import os
import pandas as pd
import data_loader

def main():
    print("=== Slack ID Auto-Lookup Script ===")
    
    # 1. Ask for Slack token
    token = input("Enter your Slack Bot Token (starts with xoxb-): ").strip()
    if not token:
        print("Error: Token cannot be empty.")
        return
        
    # 2. Get excel path
    excel_path = data_loader.get_excel_path()
    if not os.path.exists(excel_path):
        print(f"Error: Excel file not found at {excel_path}")
        return
        
    print(f"Loading Excel file from {excel_path}...")
    df = data_loader.load_data(excel_path)
    if df.empty:
        print("Error: Excel file is empty.")
        return
        
    print("Scanning for missing Slack IDs...")
    updated_count = 0
    
    for idx, row in df.iterrows():
        # Look up Primary CSM email
        email1 = row.get("csm_email_1", "").strip()
        slack1 = row.get("csm_slack_1", "").strip()
        if email1 and (not slack1 or slack1 in ["", "nan", "None"]):
            print(f"Looking up Primary CSM: {email1}...")
            slack_id = data_loader.lookup_slack_id_by_email(email1, token)
            if slack_id:
                df.at[idx, "csm_slack_1"] = slack_id
                print(f"  -> Found ID: {slack_id}")
                updated_count += 1
            else:
                print("  -> Not found")
                
        # Look up Secondary CSM email
        email2 = row.get("csm_email_2", "").strip()
        slack2 = row.get("csm_slack_2", "").strip()
        if email2 and (not slack2 or slack2 in ["", "nan", "None"]):
            print(f"Looking up Secondary CSM: {email2}...")
            slack_id = data_loader.lookup_slack_id_by_email(email2, token)
            if slack_id:
                df.at[idx, "csm_slack_2"] = slack_id
                print(f"  -> Found ID: {slack_id}")
                updated_count += 1
            else:
                print("  -> Not found")
                
    if updated_count > 0:
        print(f"\nSaving {updated_count} new Slack ID mappings to Excel...")
        data_loader.save_data(df, excel_path)
        print("Success! Excel file updated.")
    else:
        print("\nNo new Slack IDs were found or mapped.")
    
    print("\nProcess finished.")
    input("Press Enter to exit...")

if __name__ == "__main__":
    main()
