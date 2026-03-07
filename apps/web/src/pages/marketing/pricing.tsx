import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Check,
  HelpCircle,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for individuals and small projects",
    price: { monthly: 0, annually: 0 },
    features: {
      accounts: "3 social accounts",
      posts: "30 scheduled posts/month",
      analytics: "Basic analytics",
      users: "1 user",
      support: "Community support",
      ai: false,
      api: false,
      sso: false,
    },
    cta: "Get Started",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For growing teams and businesses",
    price: { monthly: 29, annually: 24 },
    features: {
      accounts: "15 social accounts",
      posts: "Unlimited posts",
      analytics: "Advanced analytics",
      users: "5 users",
      support: "Priority support",
      ai: true,
      api: true,
      sso: false,
    },
    cta: "Start Free Trial",
    popular: true,
  },
  {
    id: "team",
    name: "Team",
    description: "For larger teams with advanced needs",
    price: { monthly: 79, annually: 66 },
    features: {
      accounts: "50 social accounts",
      posts: "Unlimited posts",
      analytics: "Custom reports",
      users: "20 users",
      support: "Dedicated support",
      ai: true,
      api: true,
      sso: true,
    },
    cta: "Start Free Trial",
    popular: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large organizations",
    price: { monthly: null, annually: null },
    features: {
      accounts: "Unlimited accounts",
      posts: "Unlimited posts",
      analytics: "White-label reports",
      users: "Unlimited users",
      support: "24/7 dedicated support",
      ai: true,
      api: true,
      sso: true,
    },
    cta: "Contact Sales",
    popular: false,
  },
];

const comparisonFeatures = [
  { name: "Social Accounts", key: "accounts" },
  { name: "Scheduled Posts", key: "posts" },
  { name: "Analytics", key: "analytics" },
  { name: "Team Members", key: "users" },
  { name: "Support", key: "support" },
  { name: "AI Assistant", key: "ai", boolean: true },
  { name: "API Access", key: "api", boolean: true },
  { name: "SSO & SAML", key: "sso", boolean: true },
];

const faqs = [
  {
    question: "Can I try Heimdall for free?",
    answer: "Yes! Our Starter plan is completely free forever. For Pro and Team plans, we offer a 14-day free trial with no credit card required.",
  },
  {
    question: "What happens when I exceed my limits?",
    answer: "We'll notify you when you're approaching your limits. You can upgrade at any time, or we'll simply pause scheduling until the next billing cycle.",
  },
  {
    question: "Can I change plans later?",
    answer: "Absolutely. You can upgrade or downgrade at any time. Changes take effect immediately, and we'll prorate any differences.",
  },
  {
    question: "Do you offer discounts for nonprofits?",
    answer: "Yes, we offer 50% off for registered nonprofits and educational institutions. Contact our sales team to apply.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, PayPal, and wire transfers for Enterprise customers. All payments are processed securely through Stripe.",
  },
  {
    question: "Is there a long-term contract?",
    answer: "No, all our plans are month-to-month or annual (with a discount). You can cancel at any time with no penalties.",
  },
];

function HeroSection() {
  return (
    <section className="relative pt-32 pb-12 overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent rounded-full blur-3xl -translate-y-1/2" />
      
      <div className="page-container relative">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted text-sm text-muted-foreground mb-6">
            Pricing
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-muted-foreground">
            Start free and scale as you grow. No hidden fees, no surprises.
          </p>
        </div>
      </div>
    </section>
  );
}

function PricingCards() {
  const [billing, setBilling] = useState<"monthly" | "annually">("monthly");

  return (
    <section className="section-spacing-sm">
      <div className="page-container">
        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={cn("text-sm", billing === "monthly" ? "text-foreground" : "text-muted-foreground")}>
            Monthly
          </span>
          <button
            type="button"
            onClick={() => setBilling(billing === "monthly" ? "annually" : "monthly")}
            className={cn(
              "relative w-12 h-6 rounded-full transition-colors",
              billing === "annually" ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "absolute top-1 left-1 size-4 rounded-full bg-white transition-transform",
                billing === "annually" && "translate-x-6"
              )}
            />
          </button>
          <span className={cn("text-sm", billing === "annually" ? "text-foreground" : "text-muted-foreground")}>
            Annually
          </span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            Save 20%
          </span>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative p-6 rounded-xl border bg-card flex flex-col",
                plan.popular && "border-primary shadow-lg ring-1 ring-primary/20"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-brand text-white text-xs font-medium">
                  Most Popular
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  {plan.price.monthly !== null ? (
                    <>
                      <span className="text-4xl font-bold">
                        ${billing === "monthly" ? plan.price.monthly : plan.price.annually}
                      </span>
                      {plan.price.monthly > 0 && (
                        <span className="text-muted-foreground">/month</span>
                      )}
                    </>
                  ) : (
                    <span className="text-2xl font-bold">Custom</span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-6 flex-1">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-primary shrink-0" />
                  <span>{plan.features.accounts}</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-primary shrink-0" />
                  <span>{plan.features.posts}</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-primary shrink-0" />
                  <span>{plan.features.analytics}</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-primary shrink-0" />
                  <span>{plan.features.users}</span>
                </li>
                {plan.features.ai && (
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="size-4 text-primary shrink-0" />
                    <span>AI Assistant</span>
                  </li>
                )}
              </ul>

              <Button
                className={cn(
                  "w-full",
                  plan.popular && "bg-gradient-brand text-white border-0"
                )}
                variant={plan.popular ? "default" : "outline"}
                asChild
              >
                <Link to={plan.id === "enterprise" ? "/contact" : "/dashboard"}>
                  {plan.cta}
                  <ArrowRight className="size-4 ml-1" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComparisonTable() {
  return (
    <section className="section-spacing bg-muted/30 border-y border-border/50">
      <div className="page-container">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Compare plans
          </h2>
          <p className="text-muted-foreground">
            See all features side by side
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b">
                <th className="text-left py-4 pr-4 font-medium text-muted-foreground">Feature</th>
                {plans.map((plan) => (
                  <th key={plan.id} className="px-4 py-4 text-center font-semibold">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((feature) => (
                <tr key={feature.key} className="border-b border-border/50">
                  <td className="py-4 pr-4 text-sm">{feature.name}</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="px-4 py-4 text-center">
                      {feature.boolean ? (
                        plan.features[feature.key as keyof typeof plan.features] ? (
                          <Check className="size-5 text-primary mx-auto" />
                        ) : (
                          <Minus className="size-5 text-muted-foreground mx-auto" />
                        )
                      ) : (
                        <span className="text-sm">
                          {plan.features[feature.key as keyof typeof plan.features]}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section className="section-spacing">
      <div className="page-container">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Frequently asked questions
          </h2>
          <p className="text-muted-foreground">
            Have a different question?{" "}
            <Link to="/contact" className="text-primary hover:underline">
              Contact us
            </Link>
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {faqs.map((faq) => (
            <div key={faq.question} className="p-6 rounded-xl border bg-card">
              <div className="flex gap-3 mb-3">
                <HelpCircle className="size-5 text-primary shrink-0 mt-0.5" />
                <h3 className="font-medium">{faq.question}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-8">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingPage() {
  return (
    <>
      <HeroSection />
      <PricingCards />
      <ComparisonTable />
      <FAQSection />
    </>
  );
}
