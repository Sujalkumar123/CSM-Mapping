import os
import pandas as pd
import data_loader

def main():
    print("=== Matching Slack Member Export to CSM Directory ===")
    
    # Paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, "slack_members.csv")
    excel_path = data_loader.get_excel_path()
    
    if not os.path.exists(csv_path):
        print(f"Error: slack_members.csv not found at {csv_path}")
        return
        
    if not os.path.exists(excel_path):
        print(f"Error: Excel mapping file not found at {excel_path}")
        return

    # Load Slack members
    print("Reading slack_members.csv...")
    try:
        slack_df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return

    # Build Email -> Slack ID lookup dictionary
    slack_lookup = {}
    for _, row in slack_df.iterrows():
        email = str(row.get("Email", "")).strip().lower()
        member_id = str(row.get("Member ID", "")).strip()
        if email and member_id and email != "nan" and member_id != "nan":
            slack_lookup[email] = member_id

    print(f"Loaded {len(slack_lookup)} email-to-Slack-ID mappings from CSV.")

    # Load Excel data
    print(f"Reading Excel file: {os.path.basename(excel_path)}...")
    df = data_loader.load_data(excel_path)
    if df.empty:
        print("Error: Excel file is empty.")
        return

    # Match and update
    updated_csm1_count = 0
    updated_csm2_count = 0
    
    for idx, row in df.iterrows():
        # Update Primary CSM
        email1 = str(row.get("csm_email_1", "")).strip().lower()
        current_slack1 = str(row.get("csm_slack_1", "")).strip()
        # If email exists, and slack ID is empty or not in correct format
        if email1 and email1 in slack_lookup:
            target_slack1 = slack_lookup[email1]
            if current_slack1 != target_slack1:
                df.at[idx, "csm_slack_1"] = target_slack1
                updated_csm1_count += 1
                
        # Update Secondary CSM
        email2 = str(row.get("csm_email_2", "")).strip().lower()
        current_slack2 = str(row.get("csm_slack_2", "")).strip()
        if email2 and email2 in slack_lookup:
            target_slack2 = slack_lookup[email2]
            if current_slack2 != target_slack2:
                df.at[idx, "csm_slack_2"] = target_slack2
                updated_csm2_count += 1

    # Save Excel data
    if updated_csm1_count > 0 or updated_csm2_count > 0:
        print(f"Mapped {updated_csm1_count} Primary CSMs and {updated_csm2_count} Secondary CSMs.")
        print("Saving updates back to Excel...")
        data_loader.save_data(df, excel_path)
        print("Success! Excel file has been updated with Slack IDs.")
    else:
        print("No new matches found. All Slack IDs are already up to date in the Excel file.")
        
    print("\nMatching process complete.")
    input("Press Enter to exit...")

if __name__ == "__main__":
    main()
