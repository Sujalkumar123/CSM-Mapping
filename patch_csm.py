import os
import pandas as pd
import data_loader

csm_updates = {
    "akshaya.p@flick2know.com": {"slack": "U090XFLUZJ5"},
    "aman.rathore@flick2know.com": {"slack": "U08NCFR9YSE"},
    "anish@flick2know.com": {"phone": "9769878141"},
    "s.ankur@flick2know.com": {"slack": "UA4RZE0FL"},
    "anupama.humbi@flick2know.com": {"phone": "6364235798", "slack": "U0B813L4T5J"},
    "apurva.nayak@flick2know.com": {"phone": "8169617356", "slack": "U09GBN0K214"},
    "abhishek.jadon@flick2know.com": {"slack": "U08TWRLMU4D"},
    "khushi.yadav@flick2know.com": {"slack": "U09ASRVKLN6"},
    "nithin.saklani@flick2know.com": {"slack": "U090XFM2FLZ"},
    "prathvi.poojary@flick2know.com": {"slack": "U09574TQE1M", "phone": "9008063332"},
    "shruti.priya@flick2know.com": {"slack": "U09QQDNJV4H"},
    "suvarna.chaudhary@flick2know.com": {"slack": "U090XFHQUE5"},
    "swapnil.nawani@flick2know.com": {"slack": "U08S96Q5B5X"},
    "taniya.biswas@flick2know.com": {"slack": "U090XFMMR8R", "phone": "9528411292"},
    "vaishali.mishra@flick2know.com": {"slack": "U08R00E8ECB"},
    "prateek.j@flick2know.com": {"phone": "8770879431"},
    "yogesh.sharma@flick2know.com": {"slack": "U08N4S3H335"}
}

csm_removals = {
    "aman@flick2know.com",
    "amulya.sharma@flick2know.com",
    "bharti.chaudhary@flick2know.com",
    "blinsia@flick2know.com",
    "diksha.dubey@flick2know.com",
    "shiva@flick2know.com",
    "jai.arora@flick2know.com",
    "linson@flick2know.com",
    "maria.aizel@flick2know.com",
    "maria@flick2know.com",
    "nikhil.y@flick2know.com",
    "omkar@flick2know.com",
    "rahul.agarwal@flick2know.com",
    "ritish.nigam@flick2know.com",
    "samdiksha@flick2know.com",
    "teezil@flick2know.com",
    "viplove@flick2know.com",
    "vivek@flick2know.com"
}

csm_name_removals = {
    "vikas kumar tandon"
}

def patch_row(row_dict):
    updated = False
    
    # --- Primary CSM Check ---
    email1 = str(row_dict.get("csm_email_1", "")).strip().lower()
    name1 = str(row_dict.get("csm_name_1", "")).strip().lower()
    
    if email1 in csm_removals or name1 in csm_name_removals:
        row_dict["csm_name_1"] = ""
        row_dict["csm_contact_1"] = ""
        row_dict["csm_email_1"] = ""
        row_dict["csm_slack_1"] = ""
        updated = True
    elif email1 in csm_updates:
        rules = csm_updates[email1]
        if "slack" in rules and row_dict.get("csm_slack_1") != rules["slack"]:
            row_dict["csm_slack_1"] = rules["slack"]
            updated = True
        if "phone" in rules and row_dict.get("csm_contact_1") != rules["phone"]:
            row_dict["csm_contact_1"] = rules["phone"]
            updated = True
    elif "abhishek singh jadon" in name1:
        if row_dict.get("csm_slack_1") != "U08TWRLMU4D":
            row_dict["csm_slack_1"] = "U08TWRLMU4D"
            updated = True
    elif "rushikesh ashok bhoite" in name1:
        if row_dict.get("csm_slack_1") != "U08R00BG999" or row_dict.get("csm_contact_1") != "7020364919":
            row_dict["csm_slack_1"] = "U08R00BG999"
            row_dict["csm_contact_1"] = "7020364919"
            updated = True

    # --- Secondary CSM Check ---
    email2 = str(row_dict.get("csm_email_2", "")).strip().lower()
    name2 = str(row_dict.get("csm_name_2", "")).strip().lower()
    
    if email2 in csm_removals or name2 in csm_name_removals:
        row_dict["csm_name_2"] = ""
        row_dict["csm_contact_2"] = ""
        row_dict["csm_email_2"] = ""
        row_dict["csm_slack_2"] = ""
        updated = True
    elif email2 in csm_updates:
        rules = csm_updates[email2]
        if "slack" in rules and row_dict.get("csm_slack_2") != rules["slack"]:
            row_dict["csm_slack_2"] = rules["slack"]
            updated = True
        if "phone" in rules and row_dict.get("csm_contact_2") != rules["phone"]:
            row_dict["csm_contact_2"] = rules["phone"]
            updated = True
    elif "abhishek singh jadon" in name2:
        if row_dict.get("csm_slack_2") != "U08TWRLMU4D":
            row_dict["csm_slack_2"] = "U08TWRLMU4D"
            updated = True
    elif "rushikesh ashok bhoite" in name2:
        if row_dict.get("csm_slack_2") != "U08R00BG999" or row_dict.get("csm_contact_2") != "7020364919":
            row_dict["csm_slack_2"] = "U08R00BG999"
            row_dict["csm_contact_2"] = "7020364919"
            updated = True
            
    return row_dict, updated

def main():
    print("=== Patching CSM Records in Excel ===")
    
    excel_path = data_loader.get_excel_path()
    if not os.path.exists(excel_path):
        print(f"Error: Excel mapping file not found at {excel_path}")
        return
        
    try:
        df = data_loader.load_data(excel_path)
        updated_records = 0
        
        for idx, row in df.iterrows():
            row_dict = dict(row)
            row_dict, is_updated = patch_row(row_dict)
            if is_updated:
                for col in row_dict:
                    df.at[idx, col] = row_dict[col]
                updated_records += 1

        if updated_records > 0:
            data_loader.save_data(df, excel_path)
            print(f"Success! Updated {updated_records} records in Excel mappings.")
        else:
            print("No records needed updating (all are up to date).")
            
    except Exception as e:
        print(f"Error executing patch: {e}")

    print("\nPatch process completed successfully.")
    input("Press Enter to exit...")

if __name__ == "__main__":
    main()
