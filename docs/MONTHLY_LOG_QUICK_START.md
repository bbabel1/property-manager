# Monthly Log - Quick Start Guide

**Get started with monthly logs in 5 minutes!**

---

## 🚀 **Quick Setup** (5 minutes)

### **Step 1: Install Dependencies**

```bash
npm install
npx playwright install chromium
```

### **Step 2: Apply Database Migrations**

```bash
npx supabase db push
```

### **Step 3: Configure Environment** (Optional but Recommended)

```bash
# Add to .env.local
RESEND_API_KEY="re_your_api_key"
EMAIL_FROM_ADDRESS="statements@yourdomain.com"
COMPANY_NAME="Your Company Name"
```

### **Step 4: Start Development Server**

```bash
npm run dev
```

### **Step 5: Test the Feature**

1. Navigate to /monthly-logs on your running dev server
2. Create a new monthly log
3. Assign a few transactions
4. Navigate through the stages
5. Generate a PDF statement

**Done! You're ready to use monthly logs.** ✨

---

## 📖 **Basic Usage**

### **Create Monthly Log**

```
1. Go to /monthly-logs
2. Click "New Monthly Log"
3. Select property, unit, period
4. Click "Create"
```

### **Assign Transactions**

```
1. Open monthly log
2. Go to Charges stage
3. Click checkbox next to unassigned transaction
4. Transaction automatically assigned (no page reload!)
5. Financial summary updates instantly
```

### **Complete Workflow**

```
1. Charges → Assign all charge transactions
2. Payments → Review rent balance
3. Bills → Verify expenses
4. Escrow → Check deposit balance
5. Management Fees → Generate fee (if applicable)
6. Owner Draw → Review calculation
7. Owner Statements → Generate PDF and send
```

### **Generate & Send Statement**

```
1. Complete all prior stages
2. Go to Owner Statements tab
3. Click "Generate PDF" (wait ~10 seconds)
4. Configure recipients (if first time)
5. Click "Send via Email"
6. Check Email History for delivery status
```

---

## 💡 **Key Features**

### **Financial Calculations**

- **Previous Balance:** Auto-calculated from prior month
- **Rent Owed:** Previous + Charges - Credits
- **Owner Draw:** Payments - Bills - Escrow
- **Net to Owner:** Charges + Payments - Bills - Fees

### **Smart UI**

- ✅ No page reloads when assigning transactions
- ✅ Real-time financial summary updates
- ✅ Sticky summary card (always visible)
- ✅ Loading skeletons for fast perceived performance

### **Professional Output**

- ✅ Branded PDF statements with your logo
- ✅ Complete transaction breakdown
- ✅ Financial summary with trends
- ✅ Email templates with download links

---

## 🔧 **Troubleshooting**

### **"No recipients configured"**

**Solution:** Add recipients in the Owner Statements tab:

1. Go to Email Recipients section
2. Enter email, name, and role
3. Click "Add Recipient"
4. Click "Save Changes"

### **"Failed to generate PDF"**

**Solution:** Ensure Playwright is installed:

```bash
npx playwright install chromium
```

### **"Emails not sending"**

**Solution:** Configure Resend:

1. Get API key from resend.com
2. Add to .env.local: `RESEND_API_KEY="re_..."`
3. Restart server
4. Test with: `npx tsx scripts/test-resend-config.ts`

---

## 📚 **Next Steps**

### **For Property Managers:**

- Read the [User Guide](./MONTHLY_LOG_README.md)
- Watch the [Video Tutorial](#) (if available)
- Try the workflow with test data

### **For Developers:**

- Review [Implementation Report](./MONTHLY_LOG_FINAL_IMPLEMENTATION_REPORT.md)
- Check [API Documentation](./api/monthly-logs.md)
- Run tests: `npm run test`

### **For Administrators:**

- Review [Resend Setup Guide](./RESEND_SETUP_GUIDE.md)
- Configure production environment variables
- Set up domain verification in Resend

---

## 🎯 **Common Use Cases**

### **Use Case 1: Standard Month-End Close**

```
Time Required: 15-30 minutes per property

1. Create monthly log for each unit
2. Assign rent charges (automatic from lease)
3. Record any late fees or credits
4. Record payments received
5. Record bills paid
6. Generate management fee
7. Generate and send statement to owner
8. Mark log complete
```

### **Use Case 2: Mid-Month Statement**

```
Time Required: 5-10 minutes

1. Open existing monthly log
2. Review current balances
3. Generate PDF for review (don't send)
4. Share with owner for questions
```

### **Use Case 3: Historical Correction**

```
Time Required: 10-20 minutes

1. Unmark completed log
2. Add/remove transactions as needed
3. Verify all calculations update
4. Regenerate PDF
5. Resend statement to recipients
6. Mark complete again
```

---

## ✅ **Checklist for First Use**

- [ ] Database migrations applied
- [ ] Development server running
- [ ] Test property created
- [ ] Test unit created
- [ ] Test lease created
- [ ] Test transactions available
- [ ] Monthly log created
- [ ] Transactions assigned
- [ ] Financial summary verified
- [ ] PDF generated successfully
- [ ] Email configured (optional)
- [ ] Recipients added (optional)
- [ ] Test email sent (optional)

---

## 🆘 **Get Help**

### **Documentation**

- [Complete User Guide](./MONTHLY_LOG_README.md)
- [Implementation Details](./MONTHLY_LOG_IMPLEMENTATION_STATUS.md)
- [API Reference](./api/monthly-logs.md)
- [Troubleshooting](./MONTHLY_LOG_README.md#troubleshooting)

### **Support Resources**

- GitHub Issues: Report bugs or request features
- Slack: #property-manager channel
- Email: support@yourcompany.com

---

**🎉 You're all set! Start creating monthly logs and experience the streamlined workflow.**

Happy accounting! 📊✨
