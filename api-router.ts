import express from 'express';

// Exported router instance for Vercel
const apiRouter = express.Router();

apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Stripe Prototype Route
apiRouter.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount, currency } = req.body;
    
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "STRIPE_SECRET_KEY is not configured." });
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount || 1000,
      currency: currency || 'usd',
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error("Stripe Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// SendGrid Prototype Route
apiRouter.post("/send-email", async (req, res) => {
  try {
    const { to, subject, text } = req.body;

    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ error: "SENDGRID_API_KEY is not configured." });
    }

    const sgMail = (await import('@sendgrid/mail')).default;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to,
      from: 'test@example.com',
      subject: subject || 'Test Email from AI Studio',
      text: text || 'This is a test email sent via SendGrid.',
    };

    await sgMail.send(msg);
    res.json({ success: true, message: "Email sent successfully" });
  } catch (error: any) {
    console.error("SendGrid Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Background Check Prototype Route
apiRouter.post("/create-background-check", async (req, res) => {
  try {
    const { candidateId, packageInfo } = req.body;
    
    if (!process.env.BACKGROUND_CHECK_API_KEY) {
      return res.status(500).json({ error: "BACKGROUND_CHECK_API_KEY is not configured." });
    }
    
    console.log(`[Background Check] Initiating check for candidate ${candidateId} with package ${packageInfo}`);
    
    res.json({ 
      success: true, 
      id: "inv_" + Math.random().toString(36).substr(2, 9),
      status: "pending",
      message: "Background check invitation created."
    });
  } catch (error: any) {
    console.error("Background Check Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Background Check Webhook Listener
apiRouter.post("/webhooks/background-check", async (req, res) => {
  try {
    const event = req.body;
    
    console.log("[Webhook Received] Background Check Event:", event.type);
    
    if (event.type === 'report.completed') {
      const reportId = event.data?.object?.id;
      const status = event.data?.object?.status;
      console.log(`[Background Check] Report ${reportId} is completed with status: ${status}`);
    }
    
    res.status(200).send("Webhook received");
  } catch (error: any) {
    console.error("Webhook Error:", error);
    res.status(400).send("Webhook Error");
  }
});

export default apiRouter;
