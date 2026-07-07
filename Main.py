import streamlit as st
import pandas as pd
import os
import math
import importlib
import data_loader
importlib.reload(data_loader)
from data_loader import load_data, save_data, get_excel_path, lookup_slack_id_by_email


# ─── Page Configuration ───
st.set_page_config(
    page_title="CSM Directory",
    page_icon="📋",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ─── Configuration Constants ───
EXCEL_PATH = get_excel_path()
SLACK_WORKSPACE = "fieldassist"  # Change this to your Slack workspace subdomain
TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "slack_token.txt")

# ─── Load Slack Bot Token ───
bot_token = ""
if os.path.exists(TOKEN_FILE):
    with open(TOKEN_FILE, "r") as f:
        bot_token = f.read().strip()

# ─── Load Custom CSS ───
css_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "style.css")
if os.path.exists(css_path):
    with open(css_path) as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)



# ─── Query Parameters & Views ───
current_view = st.query_params.get("view", "clients")

# ─── Session State ───
if "page" not in st.session_state:
    st.session_state.page = 1
if "show_add_form" not in st.session_state:
    st.session_state.show_add_form = False

# ─── Load Data ───
df = load_data(EXCEL_PATH)

# ─── Auto-Patch CSM Records ───
if "patched_csm_records" not in st.session_state:
    try:
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

        updated_count = 0
        for idx, row in df.iterrows():
            row_dict = dict(row)
            row_dict, is_updated = patch_row(row_dict)
            if is_updated:
                for col in row_dict:
                    df.at[idx, col] = row_dict[col]
                updated_count += 1
                
        if updated_count > 0:
            save_data(df, EXCEL_PATH)
            st.toast(f"⚡ Auto-patched {updated_count} CSM records!")
        st.session_state.patched_csm_records = True
    except Exception as e:
        st.sidebar.error(f"Patch error: {e}")


if df.empty:
    st.warning("⚠️ No data found. Place your Excel file in the project folder.")
    st.stop()



# ─── Build Filter Options ───
all_csm_names = sorted(set(
    [n for n in df["csm_name_1"].unique().tolist() + df["csm_name_2"].unique().tolist() if n != ""]
))
all_products = sorted(set([p for p in df["product"].unique().tolist() if p != ""]))
all_company_names = sorted(set([c for c in df["legalName"].unique().tolist() if c != ""]))

# ════════════════════════════════════════
#  SIDEBAR (Filters & CSM Adding Form)
# ════════════════════════════════════════
st.sidebar.markdown("## Filters")
selected_csm = st.sidebar.selectbox("CSM", ["All CSMs"] + all_csm_names)
selected_product = st.sidebar.selectbox("Product", ["All Products"] + all_products)
sort_option = st.sidebar.selectbox("Sort by", [
    "CSM name (A-Z)", "CSM name (Z-A)", 
    "Company name (A-Z)", "Company name (Z-A)",
    "ID (Ascending)", "ID (Descending)"
])

st.sidebar.markdown("---")




# ─── ADD NEW CSM BUTTON (sidebar) ───
if st.sidebar.button("➕ Add New CSM", use_container_width=True, type="primary"):
    st.session_state.show_add_form = not st.session_state.show_add_form

# ─── Show Form underneath the button in the left side (sidebar) ───
if st.session_state.show_add_form:
    st.sidebar.markdown("### ➕ Add New CSM Details")
    with st.sidebar.form("add_csm_form", clear_on_submit=True):
        new_company = st.text_input("Company (Legal Name) *", placeholder="e.g. Acme Corp")
        new_product = st.selectbox("Product", [""] + all_products)
        new_csm_name = st.text_input("Primary CSM Name *", placeholder="e.g. John Doe")
        
        phone_blank = st.checkbox("📞 Mark phone as blank")
        if phone_blank:
            new_csm_phone = ""
        else:
            new_csm_phone = st.text_input("CSM Phone Number", placeholder="e.g. +91-9876543210")
        
        email_blank = st.checkbox("📧 Mark email as blank")
        if email_blank:
            new_csm_email = ""
        else:
            new_csm_email = st.text_input("CSM Email", placeholder="e.g. john@company.com")
            
        new_csm_slack = st.text_input("CSM Slack Member ID", placeholder="e.g. U05AB12CD")
            
        st.markdown("**Secondary CSM (optional)**")
        new_csm2_name = st.text_input("Secondary Name", placeholder="Secondary CSM name")
        new_csm2_phone = st.text_input("Secondary Phone", placeholder="Phone number")
        new_csm2_email = st.text_input("Secondary Email", placeholder="Email address")
        new_csm2_slack = st.text_input("Secondary Slack Member ID", placeholder="e.g. U05XY34YZ")
        
        st.markdown("**Lead (optional)**")
        new_lead_name = st.text_input("Lead Name", placeholder="Lead name")
        new_lead_phone = st.text_input("Lead Phone", placeholder="Lead phone")
        new_lead_email = st.text_input("Lead Email", placeholder="Lead email")
        
        submitted = st.form_submit_button("✅ Save CSM", type="primary", use_container_width=True)
        if submitted:
            if not new_company or not new_csm_name:
                st.error("❌ Company and CSM Name are required.")
            else:
                all_ids = pd.to_numeric(df["id"], errors="coerce").dropna().astype(int).tolist()
                next_id = str(max(all_ids) + 1) if all_ids else "1"
                
                new_row = {
                    "id": next_id,
                    "legalName": new_company,
                    "aliasBrand": "",
                    "product": new_product if new_product else "",
                    "csm_name_1": new_csm_name,
                    "csm_contact_1": new_csm_phone,
                    "csm_email_1": new_csm_email,
                    "csm_name_2": new_csm2_name,
                    "csm_email_2": new_csm2_email,
                    "csm_contact_2": new_csm2_phone,
                    "lead_name": new_lead_name,
                    "lead_contact": new_lead_phone,
                    "lead_email": new_lead_email,
                    "csm_slack_1": new_csm_slack,
                    "csm_slack_2": new_csm2_slack
                }
                
                updated_df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
                save_data(updated_df, EXCEL_PATH)
                st.success(f"✅ Added {new_csm_name}!")
                st.session_state.show_add_form = False
                st.rerun()

st.sidebar.markdown("---")

# ─── Edit / Remove (sidebar expander) ───
with st.sidebar.expander("✏️ Edit / Remove CSM"):
    if not df.empty:
        options = df.apply(
            lambda r: f"[{r['id']}] {r['legalName']} ({r['csm_name_1']})", axis=1
        ).tolist()
        selected = st.selectbox("Select Record", options, label_visibility="collapsed")
        row_id = selected.split("]")[0].replace("[", "").strip()
        match = df[df["id"] == row_id]
        
        if not match.empty:
            row_idx = match.index[0]
            row_data = df.loc[row_idx]
            
            action = st.radio("Action", ["Edit", "Remove"], horizontal=True)
            
            if action == "Edit":
                with st.form("edit_form"):
                    e_company = st.text_input("Company", value=row_data["legalName"])
                    e_product = st.text_input("Product", value=row_data["product"])
                    e_csm1 = st.text_input("CSM Name", value=row_data["csm_name_1"])
                    e_phone1 = st.text_input("Phone", value=row_data["csm_contact_1"])
                    e_email1 = st.text_input("Email", value=row_data["csm_email_1"])
                    e_slack1 = st.text_input("CSM Slack ID", value=row_data.get("csm_slack_1", ""))
                    
                    e_csm2 = st.text_input("CSM 2 Name", value=row_data["csm_name_2"])
                    e_phone2 = st.text_input("CSM 2 Phone", value=row_data["csm_contact_2"])
                    e_email2 = st.text_input("CSM 2 Email", value=row_data["csm_email_2"])
                    e_slack2 = st.text_input("CSM 2 Slack ID", value=row_data.get("csm_slack_2", ""))
                    
                    if st.form_submit_button("💾 Save Changes"):
                        df.at[row_idx, "legalName"] = e_company
                        df.at[row_idx, "product"] = e_product
                        df.at[row_idx, "csm_name_1"] = e_csm1
                        df.at[row_idx, "csm_contact_1"] = e_phone1
                        df.at[row_idx, "csm_email_1"] = e_email1
                        df.at[row_idx, "csm_name_2"] = e_csm2
                        df.at[row_idx, "csm_contact_2"] = e_phone2
                        df.at[row_idx, "csm_email_2"] = e_email2
                        df.at[row_idx, "csm_slack_1"] = e_slack1
                        df.at[row_idx, "csm_slack_2"] = e_slack2
                        save_data(df, EXCEL_PATH)
                        st.success("✅ Updated!")
                        st.rerun()
            
            elif action == "Remove":
                st.warning(f"Delete **{row_data['legalName']}**?")
                if st.button("🗑️ Confirm Delete", type="primary"):
                    df = df.drop(row_idx).reset_index(drop=True)
                    save_data(df, EXCEL_PATH)
                    st.success("✅ Removed!")
                    st.rerun()

st.sidebar.markdown("---")
csv = df.to_csv(index=False).encode("utf-8")
st.sidebar.download_button("📥 Download CSV", csv, "csm_directory.csv", "text/csv", use_container_width=True)


# ════════════════════════════════════════
#  MAIN CONTENT AREA
# ════════════════════════════════════════

st.markdown("# 📋 CSM Directory")

# ─── KPI Metrics ───
total_csms = len(all_csm_names)
total_clients = len(df)
missing_phone = len(df[(df["csm_name_1"] != "") & (df["csm_contact_1"] == "")])
missing_email = len(df[(df["csm_name_1"] != "") & (df["csm_email_1"] == "")])

kpi_html = f"""
<div class="kpi-container">
    <a href="?view=clients" target="_self" class="kpi-card kpi-blue" style="text-decoration: none; color: #fff;">
        <div class="kpi-title">Total Clients</div>
        <div class="kpi-value">{total_clients}</div>
    </a>
    <a href="?view=csm" target="_self" class="kpi-card kpi-purple" style="text-decoration: none; color: #fff;">
        <div class="kpi-title">Total CSM</div>
        <div class="kpi-value">{total_csms}</div>
    </a>
    <a href="?view=missing_phone" target="_self" class="kpi-card kpi-orange" style="text-decoration: none; color: #fff;">
        <div class="kpi-title">Missing Phone</div>
        <div class="kpi-value">{missing_phone}</div>
    </a>
    <a href="?view=missing_email" target="_self" class="kpi-card kpi-red" style="text-decoration: none; color: #fff;">
        <div class="kpi-title">Missing Email</div>
        <div class="kpi-value">{missing_email}</div>
    </a>
</div>
"""
st.markdown(kpi_html, unsafe_allow_html=True)

# ─── Search Bar (Searchable Dropdown Selectbox) ───
search_options = [""] + [f"🏢 {c}" for c in all_company_names] + [f"👤 {n}" for n in all_csm_names]
selected_search = st.selectbox(
    "🔍 Search",
    options=search_options,
    index=0,
    placeholder="Search by CSM or Company name...",
    label_visibility="collapsed"
)

# ════════════════════════════════════════
#  FILTER + SORT DATA
# ════════════════════════════════════════
filtered_df = df.copy()

# Apply KPI filter based on the active view
if current_view == "missing_phone":
    filtered_df = filtered_df[(filtered_df["csm_name_1"] != "") & (filtered_df["csm_contact_1"] == "")]
elif current_view == "missing_email":
    filtered_df = filtered_df[(filtered_df["csm_name_1"] != "") & (filtered_df["csm_email_1"] == "")]

if selected_csm != "All CSMs":
    filtered_df = filtered_df[
        (filtered_df["csm_name_1"] == selected_csm) | 
        (filtered_df["csm_name_2"] == selected_csm)
    ]
if selected_product != "All Products":
    filtered_df = filtered_df[filtered_df["product"] == selected_product]

if selected_search:
    q = selected_search[2:]  # Remove emoji prefix and space
    if selected_search.startswith("🏢"):
        filtered_df = filtered_df[filtered_df["legalName"] == q]
    elif selected_search.startswith("👤"):
        filtered_df = filtered_df[
            (filtered_df["csm_name_1"] == q) | 
            (filtered_df["csm_name_2"] == q)
        ]

# Sorting
if not filtered_df.empty:
    filtered_df["_unassigned_sort"] = (filtered_df["csm_name_1"].isna() | (filtered_df["csm_name_1"].astype(str).str.strip() == "")).astype(int)
    
    if sort_option == "CSM name (A-Z)":
        filtered_df = filtered_df.sort_values(by=["_unassigned_sort", "csm_name_1"], ascending=[True, True])
    elif sort_option == "CSM name (Z-A)":
        filtered_df = filtered_df.sort_values(by=["_unassigned_sort", "csm_name_1"], ascending=[True, False])
    elif sort_option == "Company name (A-Z)":
        filtered_df = filtered_df.sort_values(by=["_unassigned_sort", "legalName"], ascending=[True, True])
    elif sort_option == "Company name (Z-A)":
        filtered_df = filtered_df.sort_values(by=["_unassigned_sort", "legalName"], ascending=[True, False])
    elif sort_option == "ID (Ascending)":
        filtered_df["_sort"] = pd.to_numeric(filtered_df["id"], errors="coerce").fillna(99999)
        filtered_df = filtered_df.sort_values(by=["_unassigned_sort", "_sort"], ascending=[True, True]).drop(columns=["_sort"])
    elif sort_option == "ID (Descending)":
        filtered_df["_sort"] = pd.to_numeric(filtered_df["id"], errors="coerce").fillna(-1)
        filtered_df = filtered_df.sort_values(by=["_unassigned_sort", "_sort"], ascending=[True, False]).drop(columns=["_sort"])
        
    filtered_df = filtered_df.drop(columns=["_unassigned_sort"])

st.markdown(
    f"<p style='color:#64748b;font-size:14px;margin:8px 0 20px;'>"
    f"Showing <b>{len(filtered_df)}</b> of <b>{len(df)}</b> records</p>",
    unsafe_allow_html=True
)

# ════════════════════════════════════════
#  LINE-BY-LINE CSM MEMBER RENDERING
# ════════════════════════════════════════

def get_initials(name):
    if not name or name.strip() == "":
        return "?"
    parts = name.split()
    return (parts[0][0] + parts[-1][0]).upper() if len(parts) >= 2 else name[0].upper()

def get_whatsapp_link(phone):
    if not phone or phone.strip() == "":
        return None
    # Keep only digits
    cleaned = "".join([c for c in str(phone) if c.isdigit()])
    if not cleaned:
        return None
    
    # Strip leading zero if present (e.g. 09876543210 -> 9876543210)
    if cleaned.startswith("0") and len(cleaned) == 11:
        cleaned = cleaned[1:]
        
    # If it is a 10-digit number, prepend India country code 91
    if len(cleaned) == 10:
        cleaned = "91" + cleaned
        
    return f"https://wa.me/{cleaned}"


if current_view == "csm":
    st.markdown("### 👤 CSM Directory")
    if st.button("⬅ Back to Clients"):
        st.query_params.clear()
        st.rerun()
        
    # Compile a unique directory of CSMs from the spreadsheet
    csm_directory = {}
    for _, row in df.iterrows():
        # Primary CSM
        name1 = row.get("csm_name_1", "").strip()
        email1 = row.get("csm_email_1", "").strip()
        phone1 = row.get("csm_contact_1", "").strip()
        slack1 = row.get("csm_slack_1", "").strip()
        if name1:
            if name1 not in csm_directory or (not csm_directory[name1]["email"] and email1):
                csm_directory[name1] = {"email": email1, "phone": phone1, "slack": slack1}
                
        # Secondary CSM
        name2 = row.get("csm_name_2", "").strip()
        email2 = row.get("csm_email_2", "").strip()
        phone2 = row.get("csm_contact_2", "").strip()
        slack2 = row.get("csm_slack_2", "").strip()
        if name2:
            if name2 not in csm_directory or (not csm_directory[name2]["email"] and email2):
                csm_directory[name2] = {"email": email2, "phone": phone2, "slack": slack2}

    # Convert to sorted list of dictionaries
    csm_list = []
    for name, info in sorted(csm_directory.items()):
        csm_list.append({
            "name": name,
            "email": info["email"],
            "phone": info["phone"],
            "slack": info["slack"]
        })

    # Render CSM members using premium custom cards
    for csm in csm_list:
        csm_name = csm["name"]
        initials = get_initials(csm_name)
        email = csm["email"]
        phone = csm["phone"]
        slack_id = csm["slack"]
        
        email_display = email if email else "Blank"
        phone_display = phone if phone else "Blank"
        
        if email:
            email_link = f"https://mail.google.com/mail/?view=cm&fs=1&to={email}"
            email_btn = f'<a href="{email_link}" target="_blank" class="action-btn-link"><div class="action-btn email-btn">✉ Compose</div></a>'
        else:
            email_btn = '<div class="action-btn disabled-btn">✉ Compose</div>'
            
        if slack_id:
            slack_link = f"slack://user?team=T041B4BGT&id={slack_id}"
            slack_btn = f'<a href="{slack_link}" class="action-btn-link"><div class="action-btn slack-btn">💬 Slack</div></a>'
        else:
            slack_btn = '<div class="action-btn disabled-btn">💬 Slack</div>'
            
        wa_link = get_whatsapp_link(phone)
        if wa_link:
            phone_btn = f'<a href="{wa_link}" target="_blank" class="action-btn-link"><div class="action-btn whatsapp-btn">📞 WhatsApp</div></a>'
        else:
            phone_btn = '<div class="action-btn disabled-btn">📞 WhatsApp</div>'

        card_html = f"""
        <div class="csm-card" style="display: flex; flex-direction: column; align-items: stretch; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 14px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
                <div class="avatar-circle">{initials}</div>
                <div>
                    <div class="csm-role-label">CSM Member</div>
                    <div class="csm-name-title">{csm_name}</div>
                </div>
            </div>
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 240px;">
                    <div style="font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Email Address</div>
                    <div style="font-size: 13.5px; color: #475569; margin-bottom: 6px; word-break: break-all;">📧 {email_display}</div>
                    {email_btn}
                </div>
                <div style="flex: 1; min-width: 240px; border-left: 1px solid #f1f5f9; padding-left: 20px;">
                    <div style="font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Phone Number</div>
                    <div style="font-size: 13.5px; color: #475569; margin-bottom: 6px;">📞 {phone_display}</div>
                    {phone_btn}
                </div>
                <div style="flex: 1; min-width: 240px; border-left: 1px solid #f1f5f9; padding-left: 20px;">
                    <div style="font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Slack Account</div>
                    <div style="font-size: 13.5px; color: #475569; margin-bottom: 6px;">💬 Slack Member ID: {slack_id if slack_id else "Not Set"}</div>
                    {slack_btn}
                </div>
            </div>
        </div>
        """
        st.markdown(card_html, unsafe_allow_html=True)

else:
    # ─── Reset items_to_show on filter change ───
    current_filter_hash = f"{selected_csm}-{selected_product}-{selected_search}-{current_view}"
    if "prev_filter_hash" not in st.session_state:
        st.session_state.prev_filter_hash = current_filter_hash

    if st.session_state.prev_filter_hash != current_filter_hash:
        st.session_state.items_to_show = 20
        st.session_state.prev_filter_hash = current_filter_hash

    if "items_to_show" not in st.session_state:
        st.session_state.items_to_show = 20

    # Slice the filtered dataframe based on infinite scroll limit
    page_df = filtered_df.iloc[0:st.session_state.items_to_show]

    # Render line-by-line using premium custom cards
    for _, row in page_df.iterrows():
        csm_name = row["csm_name_1"] if row["csm_name_1"] else "Unassigned"
        initials = get_initials(csm_name)
        company = row["legalName"] if row["legalName"] else "Unknown"
        client_id = row["id"]
        product_val = row["product"] if row["product"] else "N/A"
        
        # --- Primary CSM details ---
        email = row["csm_email_1"] if row["csm_email_1"] else ""
        phone = row["csm_contact_1"] if row["csm_contact_1"] else ""
        slack_id = row.get("csm_slack_1", "")
        
        email_display = email if email else "Blank"
        phone_display = phone if phone else "Blank"
        
        if email:
            email_link = f"https://mail.google.com/mail/?view=cm&fs=1&to={email}"
            email_btn = f'<a href="{email_link}" target="_blank" class="action-btn-link"><div class="action-btn email-btn">✉ Compose</div></a>'
        else:
            email_btn = '<div class="action-btn disabled-btn">✉ Compose</div>'
            
        if slack_id:
            slack_link = f"slack://user?team=T041B4BGT&id={slack_id}"
            slack_btn = f'<a href="{slack_link}" class="action-btn-link"><div class="action-btn slack-btn">💬 Slack</div></a>'
        else:
            slack_btn = '<div class="action-btn disabled-btn">💬 Slack</div>'
            
        wa_link = get_whatsapp_link(phone)
        if wa_link:
            phone_btn = f'<a href="{wa_link}" target="_blank" class="action-btn-link"><div class="action-btn whatsapp-btn">📞 WhatsApp</div></a>'
        else:
            phone_btn = '<div class="action-btn disabled-btn">📞 WhatsApp</div>'

        # --- Secondary CSM details ---
        csm_name_2 = row.get("csm_name_2", "")
        secondary_html = ""
        if csm_name_2 and str(csm_name_2).strip() != "" and str(csm_name_2).strip().lower() != "nan":
            initials2 = get_initials(csm_name_2)
            email2 = row.get("csm_email_2", "")
            phone2 = row.get("csm_contact_2", "")
            slack_id2 = row.get("csm_slack_2", "")
            
            email2_display = email2 if email2 else "Blank"
            phone2_display = phone2 if phone2 else "Blank"
            
            if email2:
                email_link2 = f"https://mail.google.com/mail/?view=cm&fs=1&to={email2}"
                email_btn2 = f'<a href="{email_link2}" target="_blank" class="action-btn-link"><div class="action-btn email-btn">✉ Compose</div></a>'
            else:
                email_btn2 = '<div class="action-btn disabled-btn">✉ Compose</div>'
                
            if slack_id2:
                slack_link2 = f"slack://user?team=T041B4BGT&id={slack_id2}"
                slack_btn2 = f'<a href="{slack_link2}" class="action-btn-link"><div class="action-btn slack-btn">💬 Slack</div></a>'
            else:
                slack_btn2 = '<div class="action-btn disabled-btn">💬 Slack</div>'
                
            wa_link2 = get_whatsapp_link(phone2)
            if wa_link2:
                phone_btn2 = f'<a href="{wa_link2}" target="_blank" class="action-btn-link"><div class="action-btn whatsapp-btn">📞 WhatsApp</div></a>'
            else:
                phone_btn2 = '<div class="action-btn disabled-btn">📞 WhatsApp</div>'
                
            secondary_html = f"""
            <div class="contact-block">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <div class="avatar-circle" style="width: 32px; height: 32px; font-size: 12px; background: linear-gradient(135deg, #10b981, #34d399);">{initials2}</div>
                    <div>
                        <div style="font-size: 10px; font-weight: 600; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px;">Secondary CSM</div>
                        <div style="font-size: 14px; font-weight: 700; color: #334155;">{csm_name_2}</div>
                    </div>
                </div>
                <div style="font-size: 12px; color: #475569; margin: 4px 0 2px 2px; word-break: break-all;">📧 {email2_display}</div>
                <div style="font-size: 12px; color: #475569; margin: 2px 0 8px 2px;">📞 {phone2_display}</div>
                <div style="display: flex; gap: 6px;">
                    {email_btn2}
                    {slack_btn2}
                    {phone_btn2}
                </div>
            </div>
            """

        # --- Lead details ---
        lead_name = row.get("lead_name", "")
        lead_html = ""
        if lead_name and str(lead_name).strip() != "" and str(lead_name).strip().lower() != "nan":
            initials_l = get_initials(lead_name)
            email_l = row.get("lead_email", "")
            phone_l = row.get("lead_contact", "")
            
            email_l_display = email_l if email_l else "Blank"
            phone_l_display = phone_l if phone_l else "Blank"
            
            if email_l:
                email_link_l = f"https://mail.google.com/mail/?view=cm&fs=1&to={email_l}"
                email_btn_l = f'<a href="{email_link_l}" target="_blank" class="action-btn-link"><div class="action-btn email-btn">✉ Compose</div></a>'
            else:
                email_btn_l = '<div class="action-btn disabled-btn">✉ Compose</div>'
                
            wa_link_l = get_whatsapp_link(phone_l)
            if wa_link_l:
                phone_btn_l = f'<a href="{wa_link_l}" target="_blank" class="action-btn-link"><div class="action-btn whatsapp-btn">📞 WhatsApp</div></a>'
            else:
                phone_btn_l = '<div class="action-btn disabled-btn">📞 WhatsApp</div>'
                
            lead_html = f"""
            <div class="contact-block">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <div class="avatar-circle" style="width: 32px; height: 32px; font-size: 12px; background: linear-gradient(135deg, #f59e0b, #fbbf24);">{initials_l}</div>
                    <div>
                        <div style="font-size: 10px; font-weight: 600; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.5px;">Account Lead</div>
                        <div style="font-size: 14px; font-weight: 700; color: #334155;">{lead_name}</div>
                    </div>
                </div>
                <div style="font-size: 12px; color: #475569; margin: 4px 0 2px 2px; word-break: break-all;">📧 {email_l_display}</div>
                <div style="font-size: 12px; color: #475569; margin: 2px 0 8px 2px;">📞 {phone_l_display}</div>
                <div style="display: flex; gap: 6px;">
                    {email_btn_l}
                    {phone_btn_l}
                </div>
            </div>
            """

        card_html = f"""
        <div class="csm-card" style="display: flex; flex-direction: column; align-items: stretch; gap: 14px;">
            <!-- Top Header of Card: Company & Product Badge -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; flex-wrap: wrap; gap: 10px;">
                <div>
                    <span style="font-weight: 700; color: #1e293b; font-size: 16px;">{company}</span>
                    <span class="csm-id-badge">ID {client_id}</span>
                </div>
                <div style="font-weight: 600; color: #4f46e5; font-size: 12px; background: #e0e7ff; padding: 4px 10px; border-radius: 6px;">{product_val}</div>
            </div>
            
            <!-- Contact Profiles Row -->
            <div style="display: flex; gap: 20px; flex-wrap: wrap; align-items: flex-start;">
                <!-- Primary CSM Contact Block -->
                <div class="contact-block" style="flex: 1; min-width: 240px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <div class="avatar-circle" style="width: 32px; height: 32px; font-size: 12px;">{initials}</div>
                        <div>
                            <div style="font-size: 10px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 0.5px;">Primary CSM</div>
                            <div style="font-size: 14px; font-weight: 700; color: #334155;">{csm_name}</div>
                        </div>
                    </div>
                    <div style="font-size: 12px; color: #475569; margin: 4px 0 2px 2px; word-break: break-all;">📧 {email_display}</div>
                    <div style="font-size: 12px; color: #475569; margin: 2px 0 8px 2px;">📞 {phone_display}</div>
                    <div style="display: flex; gap: 6px;">
                        {email_btn}
                        {slack_btn}
                        {phone_btn}
                    </div>
                </div>
                
                <!-- Secondary CSM Contact Block -->
                {secondary_html}
                
                <!-- Lead Contact Block -->
                {lead_html}
            </div>
        </div>
        """
        st.markdown(card_html, unsafe_allow_html=True)

    # --- Infinite Scroll Loader ---
    if st.session_state.items_to_show < len(filtered_df):
        st.markdown("<div style='height:20px'></div>", unsafe_allow_html=True)
        if st.button("Load More Records...", key="load_more_btn", use_container_width=True):
            st.session_state.items_to_show += 20
            st.rerun()
            
        # Automatic Trigger Script
        st.markdown("""
        <script>
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    let buttons = document.querySelectorAll('button');
                    if (buttons.length === 0) {
                        buttons = window.parent.document.querySelectorAll('button');
                    }
                    for (const btn of buttons) {
                        if (btn.textContent.includes('Load More Records')) {
                            btn.click();
                            break;
                        }
                    }
                }
            });
        }, { threshold: 0.1 });

        setTimeout(() => {
            let buttons = document.querySelectorAll('button');
            if (buttons.length === 0) {
                buttons = window.parent.document.querySelectorAll('button');
            }
            for (const btn of buttons) {
                if (btn.textContent.includes('Load More Records')) {
                    observer.observe(btn);
                    break;
                }
            }
        }, 1000);
        </script>
        """, unsafe_allow_html=True)
