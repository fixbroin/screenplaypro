import type { ContentPage, FirestoreFAQ, FirestoreBlogPost } from '@/types/firestore';

export const DEFAULT_CONTENT_PAGES: Record<string, Omit<ContentPage, 'id'>> = {
  "cancellation-policy": {
    slug: "cancellation-policy",
    title: "Cancellation & Refund Policy",
    excerpt: "Clear details on subscription cancellations, payment terms, and our strict no-refund policy at Screenplay Pro.",
    metaTitle: "Cancellation & Refund Policy | Screenplay Pro",
    metaDescription: "Read the official cancellation and refund policy for Screenplay Pro subscriptions. All payments are non-refundable.",
    content: `<div class="space-y-6 text-foreground">
  <div class="bg-destructive/10 border border-destructive/30 rounded-2xl p-6 mb-8 text-center">
    <h2 class="text-2xl font-bold text-destructive mb-2">CANCELLATION & REFUND POLICY NOTICE</h2>
    <p class="text-lg font-bold text-foreground">THERE IS NO REFUND FOR ANY ACTIVE SUBSCRIPTION, RENEWAL, OR PURCHASE ON SCREENPLAY PRO.</p>
  </div>

  <h3 class="text-xl font-bold">1. Subscription Cancellation</h3>
  <p>You can cancel your Screenplay Pro subscription at any time directly from your Account Settings. Upon cancellation, your subscription auto-renewal will be disabled immediately, and you will not be billed for subsequent billing cycles.</p>

  <h3 class="text-xl font-bold">2. Strict No-Refund Policy</h3>
  <p>All subscription purchases, plan renewals, and feature unlocks on Screenplay Pro are final and non-refundable. <strong>THERE IS NO REFUND</strong> issued under any circumstances, including but not limited to:</p>
  <ul class="list-disc pl-6 space-y-2">
    <li>Partial month or partial term usage after billing.</li>
    <li>Unused subscription periods or early account termination.</li>
    <li>Accidental subscription renewals or change of mind.</li>
    <li>Inactivity or failure to export scripts during your billing cycle.</li>
  </ul>

  <h3 class="text-xl font-bold">3. Continuation of Access Until Term Expiry</h3>
  <p>When you cancel a subscription before your plan expiration date, your account maintains full access to Screenplay Pro premium formatting features, multi-language tools, and script exports until the end of your current paid billing period.</p>

  <h3 class="text-xl font-bold">4. Payment Gateway & Failed Transactions</h3>
  <p>If a billing transaction fails or is disputed directly through your card issuer or bank, Screenplay Pro reserves the right to suspend account access until all dues are cleared. Payment charges processed via UPI, NetBanking, Credit/Debit cards, or Razorpay cannot be refunded once authorized.</p>

  <h3 class="text-xl font-bold">5. Contact Support</h3>
  <p>For questions regarding account billing status or subscription management, contact our support team at <a href="mailto:support@screenplaypro.in" class="text-primary underline font-medium">support@screenplaypro.in</a> or call <strong>+91-7353113455</strong>.</p>
</div>`,
    updatedAt: new Date().toISOString(),
  },

  "about-us": {
    slug: "about-us",
    title: "About Screenplay Pro",
    excerpt: "Discover Screenplay Pro - India's premier online screenplay editor and story creation platform for screenwriters, directors, and authors.",
    metaTitle: "About Us | Screenplay Pro",
    metaDescription: "Learn more about Screenplay Pro - India's leading screenplay writing, script formatting, and story creation platform.",
    content: `<div class="space-y-6 text-foreground">
  <h2 class="text-3xl font-headline font-bold text-primary mb-4">Empowering Storytellers Across Cinema & Digital Media</h2>
  <p class="text-lg leading-relaxed">Screenplay Pro is an advanced online screenplay formatting and script management platform crafted specifically for film screenwriters, directors, playwrights, and content creators. Whether you are drafting a feature-length film, web series, short film, or stage play, Screenplay Pro provides seamless industry-standard formatting tools without distracting mechanics.</p>

  <h3 class="text-2xl font-headline font-bold mt-8 mb-4">Core Platform Features</h3>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
    <div class="p-5 border border-border rounded-2xl bg-card">
      <h4 class="font-bold text-lg mb-2 text-primary">Industry-Standard Formatting</h4>
      <p class="text-sm text-muted-foreground">Automatic formatting for Scene Headings (sluglines), Action blocks, Character names, Parentheticals, Dialogue, and Transitions according to global film industry standards.</p>
    </div>
    <div class="p-5 border border-border rounded-2xl bg-card">
      <h4 class="font-bold text-lg mb-2 text-primary">Multi-Language Typing Support</h4>
      <p class="text-sm text-muted-foreground">Type scripts effortlessly in English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, and other regional languages directly within your browser.</p>
    </div>
    <div class="p-5 border border-border rounded-2xl bg-card">
      <h4 class="font-bold text-lg mb-2 text-primary">Script Outlining & Plotting</h4>
      <p class="text-sm text-muted-foreground">Organize character arcs, scene breakdowns, three-act story structures, and beat sheets before writing your first dialogue line.</p>
    </div>
    <div class="p-5 border border-border rounded-2xl bg-card">
      <h4 class="font-bold text-lg mb-2 text-primary">Seamless PDF & Fountain Export</h4>
      <p class="text-sm text-muted-foreground">Export clean, print-ready PDF screenplays with standard margins, or export Fountain and text files for backup and cross-platform editing.</p>
    </div>
  </div>

  <h3 class="text-2xl font-headline font-bold mt-8 mb-4">Complete Script Privacy & Ownership</h3>
  <p>We respect creator intellectual property above all else. Writers retain <strong>100% full ownership and copyright</strong> of all screenplays, outlines, and notes produced on Screenplay Pro. Your data is stored securely and never shared with third parties.</p>

  <h3 class="text-2xl font-headline font-bold mt-8 mb-4">Our Vision</h3>
  <p>To eliminate formatting friction for screenwriters and provide modern tools that inspire compelling storytelling in regional and global cinema.</p>
</div>`,
    updatedAt: new Date().toISOString(),
  },

  "terms-and-conditions": {
    slug: "terms-and-conditions",
    title: "Terms & Conditions",
    excerpt: "The official terms of service governing your access to and use of Screenplay Pro services.",
    metaTitle: "Terms & Conditions | Screenplay Pro",
    metaDescription: "Read the official terms and conditions governing the use of Screenplay Pro services and software.",
    content: `<div class="space-y-6 text-foreground">
  <p class="text-muted-foreground">Last updated: October 2026</p>

  <h3 class="text-xl font-bold">1. Agreement to Terms</h3>
  <p>By accessing or using the Screenplay Pro website and services, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must discontinue using our services.</p>

  <h3 class="text-xl font-bold">2. User Accounts & Registration</h3>
  <p>When creating an account via Email, Google, or OTP login, you agree to provide accurate and complete registration information (including Name, Email, and Mobile Phone Number). You are responsible for safeguarding your login credentials.</p>

  <h3 class="text-xl font-bold">3. Intellectual Property Rights & Ownership</h3>
  <p>Screenplay Pro makes no claim of ownership over any screenplay, outline, document, or script uploaded or created by you. You retain 100% full copyright, title, and ownership of your intellectual property.</p>

  <h3 class="text-xl font-bold">4. Acceptable Use Policy</h3>
  <p>You agree not to modify, reverse engineer, hack, or exploit Screenplay Pro platform. You must not upload viruses, malicious code, or illegal content that infringes upon third-party rights.</p>

  <h3 class="text-xl font-bold">5. Subscription & Payment Terms</h3>
  <p>Access to premium formatting features and unlimited exports requires an active subscription. All subscription rates are displayed prior to purchase. Subscription renewals are processed automatically unless canceled prior to the renewal date.</p>

  <h3 class="text-xl font-bold">6. Cancellation & Refunds</h3>
  <p>Subscriptions may be canceled at any time. <strong>THERE IS NO REFUND</strong> for any subscription charges, partial billing cycles, or unused service periods once payment has been authorized.</p>

  <h3 class="text-xl font-bold">7. Disclaimer of Warranties</h3>
  <p>Screenplay Pro services are provided "as is" and "as available". While we maintain continuous server availability and data backups, Screenplay Pro is not liable for indirect data loss resulting from local browser failure or user misconduct.</p>

  <h3 class="text-xl font-bold">8. Governing Law</h3>
  <p>These terms are governed by the laws of India. Any disputes arising from your use of Screenplay Pro shall be subject to the exclusive jurisdiction of courts in Bengaluru, Karnataka.</p>
</div>`,
    updatedAt: new Date().toISOString(),
  },

  "privacy-policy": {
    slug: "privacy-policy",
    title: "Privacy Policy",
    excerpt: "Learn how Screenplay Pro collects, protects, and handles your personal information and screenplay data.",
    metaTitle: "Privacy Policy | Screenplay Pro",
    metaDescription: "Understand Screenplay Pro's privacy policy, user data security measures, and script confidentiality policies.",
    content: `<div class="space-y-6 text-foreground">
  <p class="text-muted-foreground">Last updated: October 2026</p>

  <h3 class="text-xl font-bold">1. Commitment to Privacy</h3>
  <p>Screenplay Pro is committed to protecting the privacy and security of our users' personal data and creative works. Your screenplays and scripts are strictly private and accessible only to you.</p>

  <h3 class="text-xl font-bold">2. Information We Collect</h3>
  <p>We collect essential information required to provide account access and manage subscription services:</p>
  <ul class="list-disc pl-6 space-y-2">
    <li><strong>Account Data:</strong> Full Name, Email Address, and Mobile Phone Number when registering via Email, Google Sign-In, or OTP.</li>
    <li><strong>Script Content:</strong> Screenplays, plot outlines, character notes, and scene drafts created within the application.</li>
    <li><strong>Payment Details:</strong> Transaction timestamps and payment confirmation IDs processed through secure payment gateways.</li>
  </ul>

  <h3 class="text-xl font-bold">3. How We Use Your Information</h3>
  <p>We use collected data solely for operating Screenplay Pro services, authenticating user sign-ins, processing subscriptions, and delivering technical support. We <strong>never sell or monetize</strong> your personal data or screenplay contents.</p>

  <h3 class="text-xl font-bold">4. Data Security & Storage</h3>
  <p>All data is transmitted using Industry-Standard SSL/TLS encryption and stored on secure cloud database servers with strict access controls and regular backups.</p>

  <h3 class="text-xl font-bold">5. Cookies & Local Storage</h3>
  <p>Screenplay Pro uses essential session cookies and browser local storage to maintain login state and store local draft saves for offline stability.</p>

  <h3 class="text-xl font-bold">6. Contact Us</h3>
  <p>If you have questions regarding our privacy practices or wish to update your account information, contact us at <a href="mailto:support@screenplaypro.in" class="text-primary underline font-medium">support@screenplaypro.in</a>.</p>
</div>`,
    updatedAt: new Date().toISOString(),
  },

  "contact-us": {
    slug: "contact-us",
    title: "Contact Us",
    excerpt: "Have questions about Screenplay Pro? Get in touch with our team for customer support, billing inquiries, or feedback.",
    metaTitle: "Contact Us | Screenplay Pro",
    metaDescription: "Contact Screenplay Pro customer support team for inquiries, feedback, or assistance with script writing tools.",
    content: `<div class="space-y-6 text-foreground">
  <p class="text-lg leading-relaxed">Have questions about Screenplay Pro features, subscription plans, or need technical support with your scripts? Our dedicated team is here to assist you.</p>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
    <div class="p-6 border border-border rounded-2xl bg-card text-center">
      <h4 class="font-bold text-lg mb-2 text-primary">Email Support</h4>
      <p class="text-muted-foreground mb-2 text-sm">Send us an email anytime</p>
      <a href="mailto:support@screenplaypro.in" class="font-semibold text-foreground hover:underline">support@screenplaypro.in</a>
    </div>
    <div class="p-6 border border-border rounded-2xl bg-card text-center">
      <h4 class="font-bold text-lg mb-2 text-primary">Phone Support</h4>
      <p class="text-muted-foreground mb-2 text-sm">Mon - Sat: 9:00 AM - 6:00 PM IST</p>
      <a href="tel:+917353113455" class="font-semibold text-foreground hover:underline">+91 7353113455</a>
    </div>
    <div class="p-6 border border-border rounded-2xl bg-card text-center">
      <h4 class="font-bold text-lg mb-2 text-primary">Office Address</h4>
      <p class="text-muted-foreground text-sm">#44 G S Palya Road, Konappana Agrahara, Electronic City Phase 2, Bengaluru, Karnataka 560100</p>
    </div>
  </div>

  <h3 class="text-2xl font-headline font-bold mb-4">Send Us a Message</h3>
  <p class="text-muted-foreground">Fill out the contact form below and our support team will respond within 24 business hours.</p>
</div>`,
    updatedAt: new Date().toISOString(),
  }
};

export const DEFAULT_FAQS: FirestoreFAQ[] = [
  {
    id: "faq_1",
    question: "What is Screenplay Pro and who is it for?",
    answer: "Screenplay Pro is a dedicated online screenplay editor and script writing platform designed for screenwriters, directors, playwrights, and storytellers. It offers automatic industry-standard formatting, multi-language typing support, scene outlining, and PDF/Fountain export options.",
    order: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "faq_2",
    question: "Are screenplays formatted according to film industry standards?",
    answer: "Yes. Screenplay Pro automatically handles Scene Headings (sluglines), Action blocks, Character names, Parentheticals, Dialogue, and Transitions according to standard screenplay formatting rules (Courier 12pt font, 1 page approx 1 minute screen time).",
    order: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "faq_3",
    question: "Can I write scripts in Indian regional languages?",
    answer: "Yes! Screenplay Pro supports multi-language typing for Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali, and English, allowing regional filmmakers to draft scripts in their native language easily.",
    order: 3,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "faq_4",
    question: "Who owns the copyright to the screenplays I create?",
    answer: "You retain 100% full copyright and ownership of all screenplays, outlines, character notes, and ideas created on Screenplay Pro. Your scripts are kept strictly private and secure.",
    order: 4,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "faq_5",
    question: "What formats can I export my scripts into?",
    answer: "You can export screenplays to print-ready PDF format, Fountain text format, plain text files, or export database backup files for complete offline storage.",
    order: 5,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "faq_6",
    question: "What is the cancellation and refund policy for subscriptions?",
    answer: "You can cancel your subscription at any time from your account settings to prevent auto-renewal. Please note that THERE IS NO REFUND for active or unused subscription periods once payment has been authorized.",
    order: 6,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export const DEFAULT_BLOG_POSTS: FirestoreBlogPost[] = [
  {
    id: "blog_1",
    title: "Mastering Industry-Standard Screenplay Formatting: A Practical Guide for Writers",
    slug: "mastering-industry-standard-screenplay-formatting",
    excerpt: "Learn the core rules of screenplay formatting—from sluglines and action blocks to character dialogue and parentheticals.",
    coverImageUrl: "/default-image.png",
    imageHint: "screenplay script writing",
    readingTime: "5 min read",
    authorName: "Screenplay Pro Team",
    isPublished: true,
    categoryName: "Screenwriting Tips",
    content: `<div class="space-y-6 text-foreground">
  <p class="text-xl leading-relaxed text-muted-foreground">Writing a professional screenplay requires more than a great story idea—it demands strict adherence to industry-standard formatting rules so production teams, script readers, and directors can easily interpret your vision.</p>

  <h2 class="text-2xl font-headline font-bold text-primary">The Standard Screenplay Elements</h2>
  <p>Every professional screenplay consists of six core formatting elements:</p>

  <h3 class="text-xl font-bold">1. Scene Headings (Sluglines)</h3>
  <p>Scene Headings establish location and time of day. They always begin with INT. (Interior) or EXT. (Exterior), followed by the specific location and time (DAY, NIGHT, DUSK, DAWN). Example: <code>INT. COFFEE SHOP - DAY</code>.</p>

  <h3 class="text-xl font-bold">2. Action Blocks</h3>
  <p>Action blocks describe visual elements and character movements in real-time, present-tense prose. Keep action paragraphs short (3-4 lines max) to maintain reader momentum.</p>

  <h3 class="text-xl font-bold">3. Character Names & Dialogue</h3>
  <p>Character names are centered above dialogue in ALL CAPS. Dialogue lines follow directly beneath with precise margins to ensure standard page-to-screen timing ratios.</p>

  <h3 class="text-xl font-bold">4. Parentheticals</h3>
  <p>Parentheticals provide subtle directional notes for how a line is spoken. Use them sparingly to avoid over-directing actors on the page.</p>

  <h2 class="text-2xl font-headline font-bold text-primary">Why Standard Formatting Matters</h2>
  <p>In the film industry, one page of properly formatted script equals approximately one minute of screen time. Utilizing Screenplay Pro guarantees your script maintains exact margins, page breaks, and standard spacing automatically.</p>
</div>`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "blog_2",
    title: "Step-by-Step Guide to Outlining Feature Films & Character Arcs",
    slug: "step-by-step-guide-to-outlining-feature-films",
    excerpt: "Discover how to outline three-act story structures, plot major story beats, and build compelling character arcs before drafting.",
    coverImageUrl: "/default-image.png",
    imageHint: "story structure plotting",
    readingTime: "7 min read",
    authorName: "Screenplay Pro Team",
    isPublished: true,
    categoryName: "Story Structure",
    content: `<div class="space-y-6 text-foreground">
  <p class="text-xl leading-relaxed text-muted-foreground">Before opening your script editor and typing "EXT. CITY STREET - DAY", taking the time to outline your feature film structure can save weeks of rewriting.</p>

  <h2 class="text-2xl font-headline font-bold text-primary">The Three-Act Structure Breakdown</h2>

  <h3 class="text-xl font-bold">Act I: Setup & Inciting Incident (Pages 1–30)</h3>
  <p>Establish your protagonist's normal world, flaws, and desires. The inciting incident (around Page 10–15) disrupts their world, forcing them onto a new path by Plot Point 1.</p>

  <h3 class="text-xl font-bold">Act II: Rising Action & Midpoint (Pages 30–90)</h3>
  <p>The protagonist faces escalating obstacles, allies, and enemies. The Midpoint (around Page 60) shifts the protagonist from reactive to proactive, leading to the All Hope Is Lost moment at Plot Point 2.</p>

  <h3 class="text-xl font-bold">Act III: Climax & Resolution (Pages 90–110)</h3>
  <p>The ultimate showdown where the protagonist overcomes their internal flaw to resolve the central conflict. The resolution offers a brief glimpse of their new normal world.</p>

  <h2 class="text-2xl font-headline font-bold text-primary">Crafting Dynamic Character Arcs</h2>
  <p>Every memorable character has a <strong>Want</strong> (external goal) and a <strong>Need</strong> (internal growth). A great screenplay tests their weakness against the central conflict until they evolve.</p>
</div>`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "blog_3",
    title: "Multi-Language Scriptwriting: Crafting Regional Cinema Scripts Online",
    slug: "multi-language-scriptwriting-regional-cinema",
    excerpt: "Explore how multi-language script writing tools allow screenwriters to draft scripts in Indian regional languages easily.",
    coverImageUrl: "/default-image.png",
    imageHint: "regional language writing",
    readingTime: "6 min read",
    authorName: "Screenplay Pro Team",
    isPublished: true,
    categoryName: "Regional Cinema",
    content: `<div class="space-y-6 text-foreground">
  <p class="text-xl leading-relaxed text-muted-foreground">Indian cinema is rich with diverse regional voices—from Kannada, Hindi, and Tamil to Telugu, Malayalam, and Marathi film industries. Screenplay Pro is built to support writers writing in their native language.</p>

  <h2 class="text-2xl font-headline font-bold text-primary">Breaking the Language Barrier in Script Editors</h2>
  <p>Traditionally, writers faced formatting issues when trying to type regional language scripts in standard software. Screenplay Pro provides seamless multi-language typing support and Unicode font handling, ensuring your dialogue renders crisp and clean on every device.</p>

  <h2 class="text-2xl font-headline font-bold text-primary">Best Practices for Regional Script Formatting</h2>
  <ul class="list-disc pl-6 space-y-3">
    <li><strong>Keep Scene Headings Standard:</strong> Standard INT./EXT. sluglines assist production crews while keeping dialogue in the native language.</li>
    <li><strong>Character Names:</strong> Use clear, consistent transliteration or native script for character headings.</li>
    <li><strong>Seamless PDF Generation:</strong> Export high-resolution PDF copies ready for table reads and casting calls.</li>
  </ul>

  <p class="mt-6">Start drafting your next regional masterpiece on Screenplay Pro today with total formatting peace of mind.</p>
</div>`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];
