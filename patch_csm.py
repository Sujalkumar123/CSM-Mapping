import os
import pandas as pd
import data_loader

def main():
    print("=== Patching Abhishek Singh Jadon's Slack ID ===")
    
    # Paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, "slack_members.csv")
    excel_path = data_loader.get_excel_path()
    
    # 1. Update slack_members.csv
    new_entry = '"Abhishek Singh Jadon","abhishek.jadon@flick2know.com","U08TWRLMU4D"\n'
    try:
        if os.path.exists(csv_path):
            with open(csv_path, "r", encoding="utf-8") as f:
                content = f.read()
            if "U08TWRLMU4D" not in content:
                with open(csv_path, "a", encoding="utf-8") as f:
                    f.write(new_entry)
                print("Slack ID added to slack_members.csv.")
            else:
                print("Slack ID already in slack_members.csv.")
        else:
            with open(csv_path, "w", encoding="utf-8") as f:
                f.write("Name,Email,Member ID\n")
                f.write(new_entry)
            print("Created slack_members.csv with the entry.")
    except Exception as e:
        print(f"Error updating CSV: {e}")

    # 2. Update Excel sheet
    if os.path.exists(excel_path):
        print(f"Updating Excel mapping file: {os.path.basename(excel_path)}...")
        try:
            df = data_loader.load_data(excel_path)
            updated_count = 0
            
            # Print columns to verify
            print("Columns in Excel data:", list(df.columns))
            
            for idx, row in df.iterrows():
                email1 = str(row.get("csm_email_1", "")).strip().lower()
                name1 = str(row.get("csm_name_1", "")).strip().lower()
                
                # Check either email or name
                if email1 == "abhishek.jadon@flick2know.com" or "abhishek singh jadon" in name1:
                    df.at[idx, "csm_slack_1"] = "U08TWRLMU4D"
                    updated_count += 1
                
                email2 = str(row.get("csm_email_2", "")).strip().lower()
                name2 = str(row.get("csm_name_2", "")).strip().lower()
                
                if email2 == "abhishek.jadon@flick2know.com" or "abhishek singh jadon" in name2:
                    df.at[idx, "csm_slack_2"] = "U08TWRLMU4D"
                    updated_count += 1
            
            if updated_count > 0:
                data_loader.save_data(df, excel_path)
                print(f"Success! Updated {updated_count} client records in Excel with Slack ID 'U08TWRLMU4D'.")
            else:
                print("No matching records found for 'Abhishek Singh Jadon' in Excel.")
        except Exception as e:
            print(f"Error updating Excel: {e}")
    else:
        print("Excel mapping file not found.")

    print("\nPatch complete. Please verify in your dashboard.")
    input("Press Enter to exit...")

if __name__ == "__main__":
    main()
