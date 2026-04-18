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
    const { candidateId, candidateEmail, packageInfo } = req.body;
    
    if (!process.env.BACKGROUND_CHECK_API_KEY) {
      return res.status(500).json({ error: "BACKGROUND_CHECK_API_KEY is not configured." });
    }
    
    if (!candidateEmail) {
      return res.status(400).json({ error: "candidateEmail is required." });
    }
    
    console.log(`[Background Check] Initiating check for candidate ${candidateId} (${candidateEmail}) with package ${packageInfo}`);
    // Prototype Note: In production, store the candidateEmail in Firebase alongside the candidateId so webhooks can email them.
    // e.g., await getFirestore().collection('candidates').doc(candidateId).set({ email: candidateEmail }, { merge: true });

    res.json({ 
      success: true, 
      id: "inv_" + Math.random().toString(36).substr(2, 9),
      status: "pending",
      message: "Background check invitation created and linked to " + candidateEmail
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
      const candidateId = event.data?.object?.candidate_id;
      
      console.log(`[Background Check] Report ${reportId} for candidate ${candidateId} is completed with status: ${status}`);
      // Prototype Note: Trigger downstream actions
      // In production, you would update Firestore using firebase-admin SDK here:
      // await getFirestore().collection('candidates').doc(candidateId).update({ status: status, reportId });
    }
    
    res.status(200).send("Webhook received");
  } catch (error: any) {
    console.error("Webhook Error:", error);
    res.status(400).send("Webhook Error");
  }
});

// Stripe Webhook Listener
apiRouter.post("/webhooks/stripe", express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("STRIPE_SECRET_KEY is missing");
      return res.status(500).send("Configuration error");
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    let event;

    // Verify webhook signature if secret is provided in environment
    if (endpointSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err: any) {
        console.error(`Webhook Signature Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      // For local development without signature verification
      event = JSON.parse(req.body.toString());
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
        // Prototype Note: 
        // 1. Mark order as 'paid'
        // 2. Adjust inventory
        // e.g. await getFirestore().collection('orders').where('paymentIntentId', '==', paymentIntent.id).update({ status: 'paid' });
        break;
      case 'payment_intent.payment_failed':
        console.log(`Payment failed: ${event.data.object.last_payment_error?.message}`);
        // Mark order as 'failed'
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error(`Stripe Webhook Error: ${error.message}`);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

export default apiRouter;
