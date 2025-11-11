# Resend Email Service Setup Guide

**Purpose:** Configure Resend for automated monthly statement delivery  
**Last Updated:** January 15, 2025

---

## 📧 **What is Resend?**

Resend is a modern email API service designed for developers. It provides:

- Simple, clean API
- Excellent deliverability rates
- Easy integration with React
- Comprehensive delivery tracking
- Generous free tier (100 emails/day, 3,000/month)

**Official Website:** https://resend.com  
**Documentation:** https://resend.com/docs

---

## 🚀 **Setup Steps**

### **Step 1: Create Resend Account**

1. Go to https://resend.com
2. Sign up for a free account
3. Verify your email address

### **Step 2: Get API Key**

1. Navigate to **API Keys** in the Resend dashboard
2. Click **Create API Key**
3. Name it: `Property Manager - Production` (or appropriate name)
4. Copy the API key (starts with `re_`)
5. **Important:** Save this key immediately - you won't see it again!

### **Step 3: Verify Domain (Production)**

For production use, you need to verify your sending domain:

1. Go to **Domains** in Resend dashboard
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Add the provided DNS records to your domain provider:
   - SPF record
   - DKIM records (usually 2-3 records)
   - DMARC record (recommended)
5. Wait for verification (usually 5-15 minutes)
6. Check verification status in Resend dashboard

**For Development/Testing:**

- Use the sandbox domain provided by Resend
- Emails will only be delivered to verified email addresses
- Add test recipients in Resend dashboard under **Testing**

### **Step 4: Configure Environment Variables**

Add these to your `.env` or `.env.local` file:

```bash
# Resend API Configuration
RESEND_API_KEY="re_your_api_key_here"
EMAIL_FROM_ADDRESS="statements@yourdomain.com"
EMAIL_FROM_NAME="Your Property Management Company"

# Company Information (for PDF statements)
COMPANY_NAME="Your Property Management Company"
COMPANY_ADDRESS="123 Main St, Suite 100, Your City, ST 12345"
COMPANY_PHONE="(555) 123-4567"
COMPANY_EMAIL="info@yourcompany.com"
COMPANY_LOGO_URL="https://yourcompany.com/logo.png"
```

**Notes:**

- `EMAIL_FROM_ADDRESS` must use your verified domain
- `EMAIL_FROM_NAME` appears as the sender name
- Company variables are used in PDF statement generation

### **Step 5: Test Configuration**

Run this command to verify your setup:

```bash
npx tsx scripts/test-resend-config.ts
```

Or manually test in Node.js:

```javascript
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

resend.emails.send({
  from: 'onboarding@resend.dev', // Use sandbox for testing
  to: 'your-email@example.com',
  subject: 'Test Email',
  html: '<h1>Hello!</h1><p>This is a test email.</p>',
});
```

---

## 🔧 **Configuration Options**

### **Email Limits**

**Free Tier:**

- 100 emails per day
- 3,000 emails per month
- 1 verified domain

**Paid Tiers:**

- Pro: $20/month - 50,000 emails/month
- Business: Custom pricing

### **Recommended Settings**

1. **Enable DKIM Signing** (automatic with domain verification)
2. **Configure SPF and DMARC** (improves deliverability)
3. **Add unsubscribe headers** (for compliance)
4. **Monitor bounce rates** (keep below 5%)

---

## 📝 **Usage in Application**

### **Send Monthly Statement**

```typescript
// In the UI (StatementsStage component)
1. Navigate to monthly log detail page
2. Go to "Owner Statements" tab
3. Click "Generate PDF" (creates PDF first)
4. Configure recipients if not already done
5. Click "Send via Email"
6. Check email history for delivery status
```

### **Configure Recipients**

```typescript
// Recipients are stored per property
// Navigate to: Properties > [Property] > Settings > Statement Recipients
// Or configure directly in the Statements tab
```

### **API Usage**

```bash
# Generate PDF
POST /api/monthly-logs/[logId]/generate-pdf

# Send statement
POST /api/monthly-logs/[logId]/send-statement

# Get email history
GET /api/monthly-logs/[logId]/statement-history

# Manage recipients
GET/PATCH /api/properties/[id]/statement-recipients
```

---

## 🛡️ **Security Best Practices**

1. **API Key Storage**
   - Never commit API keys to version control
   - Use environment variables only
   - Rotate keys periodically

2. **Email Validation**
   - Validate email addresses before sending
   - Use proper email regex patterns
   - Check for duplicates in recipient lists

3. **Rate Limiting**
   - Respect Resend's rate limits
   - Implement backoff for failures
   - Monitor daily/monthly quotas

4. **Error Handling**
   - Log all email failures
   - Retry failed sends (with exponential backoff)
   - Alert admins for persistent failures

---

## 🐛 **Troubleshooting**

### **Emails Not Being Delivered**

1. **Check API Key**

   ```bash
   echo $RESEND_API_KEY  # Should start with "re_"
   ```

2. **Verify Domain**
   - Check DNS records are properly configured
   - Wait 15-30 minutes for DNS propagation
   - Verify in Resend dashboard

3. **Check Spam Folder**
   - For first-time sends, check recipient spam
   - Improve deliverability with SPF/DKIM/DMARC

4. **Review Logs**
   - Check Resend dashboard for delivery status
   - Review `statement_emails` table in database
   - Check server logs for errors

### **Common Errors**

**"API key not configured"**

- Add `RESEND_API_KEY` to environment variables
- Restart Next.js dev server

**"Email address not verified"**

- In development mode, add recipient to verified addresses in Resend
- Or verify your domain for production

**"Rate limit exceeded"**

- Check your Resend plan limits
- Implement queuing for bulk sends
- Upgrade plan if needed

---

## 📊 **Monitoring & Analytics**

### **Resend Dashboard**

Track these metrics:

- **Delivery Rate** - Should be >95%
- **Bounce Rate** - Keep below 5%
- **Complaint Rate** - Keep below 0.1%
- **Open Rate** - Typically 20-40% for statements

### **Database Audit Log**

Query `statement_emails` table:

```sql
-- Recent statement sends
SELECT
  sent_at,
  status,
  recipients,
  error_message
FROM statement_emails
ORDER BY sent_at DESC
LIMIT 20;

-- Failed sends
SELECT *
FROM statement_emails
WHERE status = 'failed'
ORDER BY sent_at DESC;
```

---

## 🔄 **Email Flow Diagram**

```
1. User clicks "Send via Email" in Statements tab
   ↓
2. System checks if PDF exists (generate if needed)
   ↓
3. Fetch statement recipients from properties table
   ↓
4. For each recipient:
   - Generate personalized email HTML
   - Send via Resend API
   - Track result (sent/failed)
   ↓
5. Create audit record in statement_emails table
   ↓
6. Display success/failure toast to user
   ↓
7. Refresh email history component
```

---

## 📚 **Additional Resources**

- [Resend Documentation](https://resend.com/docs)
- [Resend React Guide](https://resend.com/docs/send-with-react)
- [Email Best Practices](https://resend.com/docs/knowledge-base/email-best-practices)
- [Deliverability Guide](https://resend.com/docs/knowledge-base/deliverability)

---

## ✅ **Checklist**

Before going live with email sending:

- [ ] Resend account created
- [ ] API key obtained and added to environment
- [ ] Domain verified (for production)
- [ ] Test email sent successfully
- [ ] Recipients configured for at least one property
- [ ] Monitoring dashboard reviewed
- [ ] Error alerts configured
- [ ] Backup recipients identified
- [ ] Email templates tested on multiple clients
- [ ] Deliverability metrics reviewed

---

**Need Help?** Contact Resend support at support@resend.com or check their documentation at https://resend.com/docs
