import streamlit as st
import pandas as pd
import os
import math
from data_loader import load_data, save_data, get_excel_path

# ─── Page Configuration ───
st.set_page_config(
    page_title="CSM Directory",
    page_icon="📋",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ─── Load Custom CSS ───
css_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "style.css")
if os.path.exists(css_path):
    with open(css_path) as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

# ─── Excel File Path ───
EXCEL_PATH = get_excel_path()

# ─── Session State ───
if "page" not in st.session_state:
    st.session_state.page = 1
if "show_add_form" not in st.session_state:
    st.session_state.show_add_form = False

# ─── Load Data ───
df = load_data(EXCEL_PATH)

if df.empty:
    st.warning("⚠️ No data found. Place your Excel file in the project folder.")
    st.stop()

# ─── Build Filter Options ───
all_csm_names = sorted(set(
    [n for n in df["csm_name_1"].unique().tolist() + df["csm_name_2"].unique().tolist() if n != ""]
))
all_products = sorted(set([p for p in df["product"].unique().tolist() if p != ""]))

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
        new_alias = st.text_input("Company Alias / Brand", placeholder="e.g. Acme")
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
            
        st.markdown("**Secondary CSM (optional)**")
        new_csm2_name = st.text_input("Secondary Name", placeholder="Secondary CSM name")
        new_csm2_phone = st.text_input("Secondary Phone", placeholder="Phone number")
        new_csm2_email = st.text_input("Secondary Email", placeholder="Email address")
        
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
                    "aliasBrand": new_alias,
                    "product": new_product if new_product else "",
                    "csm_name_1": new_csm_name,
                    "csm_contact_1": new_csm_phone,
                    "csm_email_1": new_csm_email,
                    "csm_name_2": new_csm2_name,
                    "csm_email_2": new_csm2_email,
                    "csm_contact_2": new_csm2_phone,
                    "lead_name": new_lead_name,
                    "lead_contact": new_lead_phone,
                    "lead_email": new_lead_email
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
                    e_alias = st.text_input("Alias", value=row_data["aliasBrand"])
                    e_product = st.text_input("Product", value=row_data["product"])
                    e_csm1 = st.text_input("CSM Name", value=row_data["csm_name_1"])
                    e_phone1 = st.text_input("Phone", value=row_data["csm_contact_1"])
                    e_email1 = st.text_input("Email", value=row_data["csm_email_1"])
                    e_csm2 = st.text_input("CSM 2 Name", value=row_data["csm_name_2"])
                    e_phone2 = st.text_input("CSM 2 Phone", value=row_data["csm_contact_2"])
                    e_email2 = st.text_input("CSM 2 Email", value=row_data["csm_email_2"])
                    
                    if st.form_submit_button("💾 Save Changes"):
                        df.at[row_idx, "legalName"] = e_company
                        df.at[row_idx, "aliasBrand"] = e_alias
                        df.at[row_idx, "product"] = e_product
                        df.at[row_idx, "csm_name_1"] = e_csm1
                        df.at[row_idx, "csm_contact_1"] = e_phone1
                        df.at[row_idx, "csm_email_1"] = e_email1
                        df.at[row_idx, "csm_name_2"] = e_csm2
                        df.at[row_idx, "csm_contact_2"] = e_phone2
                        df.at[row_idx, "csm_email_2"] = e_email2
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
    <div class="kpi-card kpi-blue">
        <div class="kpi-title">Total Clients</div>
        <div class="kpi-value">{total_clients}</div>
    </div>
    <div class="kpi-card kpi-purple">
        <div class="kpi-title">Total CSMs</div>
        <div class="kpi-value">{total_csms}</div>
    </div>
    <div class="kpi-card kpi-orange">
        <div class="kpi-title">Missing Phone</div>
        <div class="kpi-value">{missing_phone}</div>
    </div>
    <div class="kpi-card kpi-red">
        <div class="kpi-title">Missing Email</div>
        <div class="kpi-value">{missing_email}</div>
    </div>
</div>
"""
st.markdown(kpi_html, unsafe_allow_html=True)

# ─── Search Bar ───
search_query = st.text_input(
    "🔍 Search",
    placeholder="Search by CSM name, company, or ID...",
    label_visibility="collapsed"
)

# ════════════════════════════════════════
#  FILTER + SORT DATA
# ════════════════════════════════════════
filtered_df = df.copy()

if selected_csm != "All CSMs":
    filtered_df = filtered_df[
        (filtered_df["csm_name_1"] == selected_csm) | 
        (filtered_df["csm_name_2"] == selected_csm)
    ]
if selected_product != "All Products":
    filtered_df = filtered_df[filtered_df["product"] == selected_product]

if search_query:
    q = search_query.lower()
    filtered_df = filtered_df[
        filtered_df["csm_name_1"].str.lower().str.contains(q, na=False) |
        filtered_df["csm_name_2"].str.lower().str.contains(q, na=False) |
        filtered_df["legalName"].str.lower().str.contains(q, na=False) |
        filtered_df["aliasBrand"].str.lower().str.contains(q, na=False) |
        filtered_df["id"].str.contains(q, na=False)
    ]

# Sorting
if sort_option == "CSM name (A-Z)":
    filtered_df = filtered_df.sort_values("csm_name_1", ascending=True)
elif sort_option == "CSM name (Z-A)":
    filtered_df = filtered_df.sort_values("csm_name_1", ascending=False)
elif sort_option == "Company name (A-Z)":
    filtered_df = filtered_df.sort_values("legalName", ascending=True)
elif sort_option == "Company name (Z-A)":
    filtered_df = filtered_df.sort_values("legalName", ascending=False)
elif sort_option == "ID (Ascending)":
    filtered_df["_sort"] = pd.to_numeric(filtered_df["id"], errors="coerce").fillna(99999)
    filtered_df = filtered_df.sort_values("_sort").drop(columns=["_sort"])
elif sort_option == "ID (Descending)":
    filtered_df["_sort"] = pd.to_numeric(filtered_df["id"], errors="coerce").fillna(-1)
    filtered_df = filtered_df.sort_values("_sort", ascending=False).drop(columns=["_sort"])

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

# Pagination
cards_per_page = 10  # Show more because they are line-by-line strips now!
total_pages = max(1, math.ceil(len(filtered_df) / cards_per_page))
if st.session_state.page > total_pages:
    st.session_state.page = total_pages

start = (st.session_state.page - 1) * cards_per_page
page_df = filtered_df.iloc[start:start + cards_per_page]

# Render line-by-line (one per row)
for _, row in page_df.iterrows():
    csm_name = row["csm_name_1"] if row["csm_name_1"] else "Unassigned"
    initials = get_initials(csm_name)
    company = row["legalName"] if row["legalName"] else "Unknown"
    client_id = row["id"]
    product_val = row["product"] if row["product"] else "N/A"
    
    email = row["csm_email_1"] if row["csm_email_1"] else ""
    phone = row["csm_contact_1"] if row["csm_contact_1"] else ""
    
    email_display = email if email else "Blank"
    phone_display = phone if phone else "Blank"
    email_class = "" if email else "blank"
    phone_class = "" if phone else "blank"    # Render each record inside a clean bordered container
    with st.container(border=True):
        col_avatar, col_fields, col_actions = st.columns([1.5, 2.5, 1.2])
        
        with col_avatar:
            avatar_html = f"""
            <div style="display: flex; align-items: center; gap: 14px; margin-top: 5px;">
                <div class="avatar-circle">{initials}</div>
                <div>
                    <div class="csm-role-label">CSM</div>
                    <div class="csm-name-title" style="margin: 0; font-size: 16px; font-weight: 700; color: #1e293b;">{csm_name}</div>
                    <div class="csm-company-subtitle" style="font-size: 13px; color: #64748b;">{company} <span class="csm-id-badge" style="background:#e0e7ff; color:#4f46e5; font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px; margin-left:6px;">ID {client_id}</span></div>
                </div>
            </div>
            """
            st.markdown(avatar_html, unsafe_allow_html=True)
            
        with col_fields:
            fields_html = f"""
            <div style="display: flex; gap: 40px; margin-top: 10px; border-left: 1px solid #f1f5f9; padding-left: 20px;">
                <div>
                    <div style="font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Email</div>
                    <div class="csm-field-value {email_class}" style="font-size: 13.5px; color: #334155;">{email_display}</div>
                </div>
                <div>
                    <div style="font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Phone</div>
                    <div class="csm-field-value {phone_class}" style="font-size: 13.5px; color: #334155;">{phone_display}</div>
                </div>
                <div>
                    <div style="font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Product</div>
                    <div style="font-size: 13.5px; color: #334155;">{product_val}</div>
                </div>
            </div>
            """
            st.markdown(fields_html, unsafe_allow_html=True)
            
        with col_actions:
            # Align the action buttons cleanly using custom HTML for client-side redirection
            st.markdown("<div style='height: 12px;'></div>", unsafe_allow_html=True)
            email_btn_html = f'<a href="https://mail.google.com/mail/?view=cm&fs=1&to={email}" target="_blank" class="action-btn email-btn" style="text-decoration: none; color: inherit; width: 100%; display: inline-flex; justify-content: center; box-sizing: border-box;">📧 Email</a>' if email else '<div class="action-btn disabled-btn" style="width: 100%; display: inline-flex; justify-content: center; box-sizing: border-box;">📧 Email</div>'
            slack_btn_html = '<div class="action-btn disabled-btn" style="width: 100%; display: inline-flex; justify-content: center; box-sizing: border-box; opacity: 0.5;">💬 Slack <span class="dummy-badge" style="font-size: 8px; background: #fbbf24; color: #78350f; padding: 1px 4px; border-radius: 4px; font-weight: 700; margin-left: 4px;">dummy</span></div>'
            
            actions_html = f"""
            <div style="display: flex; gap: 8px; width: 100%;">
                <div style="flex: 1; display: flex;">
                    {email_btn_html}
                </div>
                <div style="flex: 1; display: flex;">
                    {slack_btn_html}
                </div>
            </div>
            """
            st.markdown(actions_html, unsafe_allow_html=True)
   


# ─── Pagination Controls ───
if total_pages > 1:
    st.markdown("<div style='height:20px'></div>", unsafe_allow_html=True)
    col_prev, col_info, col_next = st.columns([1, 3, 1])
    with col_prev:
        if st.button("⬅ Previous", disabled=(st.session_state.page <= 1)):
            st.session_state.page -= 1
            st.rerun()
    with col_info:
        st.markdown(
            f"<p style='text-align:center;color:#64748b;margin-top:8px;'>"
            f"Page {st.session_state.page} of {total_pages}</p>",
            unsafe_allow_html=True
        )
    with col_next:
        if st.button("Next ➡", disabled=(st.session_state.page >= total_pages)):
            st.session_state.page += 1
            st.rerun()
