import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Marquee } from "@/components/ui/marquee";
import { Spotlight, SpotLightItem } from "@/components/ui/spotlight";
import {
  ArrowRight,
  Play,
  Sparkles,
  Calendar,
  BarChart3,
  Zap,
  Shield,
  Users,
  Check,
  ArrowUpRight,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// HERO SECTION
// =============================================================================

function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute top-1/3 right-0 w-[500px] h-[300px] bg-gradient-to-bl from-primary/15 via-transparent to-transparent rounded-full blur-3xl translate-x-1/3" />
      
      <div className="page-container relative">
        <div className="max-w-4xl mx-auto text-center stagger-children">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-sm text-primary mb-6">
            <Sparkles className="size-3.5" />
            <span>Now with AI-powered content generation</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            Your all-seeing eye for{" "}
            <span className="text-gradient-brand">social media</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Heimdall gives you complete oversight of your social presence. Create, schedule, 
            and analyze across all platforms from one powerful dashboard.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button size="lg" asChild className="h-12 px-8 text-base bg-gradient-brand text-white border-0 glow">
              <Link to="/dashboard">
                Start Free Trial
                <ArrowRight className="size-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base">
              <Play className="size-4 mr-2" />
              Watch Demo
            </Button>
          </div>

          {/* Dashboard Preview */}
          <div className="relative mx-auto max-w-5xl">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-xl border bg-card/50 backdrop-blur-sm shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-red-500/60" />
                  <div className="size-3 rounded-full bg-amber-500/60" />
                  <div className="size-3 rounded-full bg-emerald-500/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded-md bg-muted text-xs text-muted-foreground">
                    app.heimdall.io/dashboard
                  </div>
                </div>
              </div>
              <div className="p-6 grid grid-cols-4 gap-4">
                <div className="col-span-1 space-y-3">
                  <div className="h-8 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-6 rounded bg-muted/50 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                    ))}
                  </div>
                </div>
                <div className="col-span-3 space-y-4">
                  <div className="grid grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-20 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 h-48 rounded-lg bg-muted/50 animate-pulse" />
                    <div className="h-48 rounded-lg bg-muted/30 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// LOGO CLOUD SECTION
// =============================================================================

const brands = [
  { name: "Vercel", logo: "V" },
  { name: "Stripe", logo: "S" },
  { name: "Notion", logo: "N" },
  { name: "Linear", logo: "L" },
  { name: "Figma", logo: "F" },
  { name: "Framer", logo: "Fr" },
  { name: "Webflow", logo: "W" },
  { name: "Supabase", logo: "Sb" },
];

function LogoCloudSection() {
  return (
    <section className="section-spacing-sm border-y border-border/50 bg-muted/30">
      <div className="page-container text-center mb-8">
        <p className="text-sm text-muted-foreground">
          Trusted by teams at leading companies
        </p>
      </div>
      <Marquee pauseOnHover className="[--duration:30s]">
        {brands.map((brand) => (
          <div
            key={brand.name}
            className="flex items-center gap-2 px-8 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <span className="text-2xl font-bold">{brand.logo}</span>
            <span className="text-lg font-medium">{brand.name}</span>
          </div>
        ))}
      </Marquee>
    </section>
  );
}

// =============================================================================
// FEATURES SECTION
// =============================================================================

const features = [
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description: "AI-powered optimal timing suggestions for maximum engagement across all platforms.",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    description: "Comprehensive insights with actionable metrics to understand your audience.",
  },
  {
    icon: Zap,
    title: "Automation",
    description: "Set up workflows and let Heimdall handle repetitive tasks automatically.",
  },
  {
    icon: Shield,
    title: "Team Permissions",
    description: "Granular access control to keep your brand voice consistent and secure.",
  },
  {
    icon: Users,
    title: "Collaboration",
    description: "Work together seamlessly with approval workflows and shared content libraries.",
  },
  {
    icon: Sparkles,
    title: "AI Assistant",
    description: "Generate captions, hashtags, and content ideas powered by advanced AI.",
  },
];

function FeaturesSection() {
  return (
    <section className="section-spacing" id="features">
      <div className="page-container">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted text-sm text-muted-foreground mb-4">
            Features
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Everything you need to dominate social
          </h2>
          <p className="text-lg text-muted-foreground">
            From scheduling to analytics, Heimdall provides all the tools you need in one unified platform.
          </p>
        </div>

        <Spotlight className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <SpotLightItem key={feature.title}>
              <div className="h-full p-6 rounded-xl bg-card">
                <div className="size-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="size-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </SpotLightItem>
          ))}
        </Spotlight>
      </div>
    </section>
  );
}

// =============================================================================
// STATS SECTION
// =============================================================================

const stats = [
  { value: "10K+", label: "Active Teams" },
  { value: "50M+", label: "Posts Scheduled" },
  { value: "99.9%", label: "Uptime" },
  { value: "4.9/5", label: "User Rating" },
];

function StatsSection() {
  return (
    <section className="section-spacing-sm bg-muted/30 border-y border-border/50">
      <div className="page-container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-gradient-brand mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// TESTIMONIALS SECTION
// =============================================================================

const testimonials = [
  {
    quote: "Heimdall has transformed how we manage our social presence. The analytics alone are worth it.",
    author: "Sarah Chen",
    role: "Marketing Director",
    company: "TechFlow",
    rating: 5,
  },
  {
    quote: "The AI suggestions save us hours every week. It's like having an extra team member.",
    author: "Marcus Rodriguez",
    role: "Social Media Manager",
    company: "GrowthLab",
    rating: 5,
  },
  {
    quote: "Finally, a tool that actually understands the complexity of multi-platform publishing.",
    author: "Emily Watson",
    role: "Content Strategist",
    company: "BrandScale",
    rating: 5,
  },
];

function TestimonialsSection() {
  return (
    <section className="section-spacing" id="testimonials">
      <div className="page-container">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted text-sm text-muted-foreground mb-4">
            Testimonials
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Loved by teams worldwide
          </h2>
          <p className="text-lg text-muted-foreground">
            See what our customers have to say about their experience with Heimdall.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.author}
              className="p-6 rounded-xl border bg-card hover:shadow-lg transition-shadow"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-foreground mb-6 leading-relaxed">"{testimonial.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-gradient-brand flex items-center justify-center text-white font-semibold text-sm">
                  {testimonial.author.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <div className="font-medium text-sm">{testimonial.author}</div>
                  <div className="text-xs text-muted-foreground">
                    {testimonial.role} at {testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// PRICING PREVIEW SECTION
// =============================================================================

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "Perfect for individuals getting started",
    features: ["3 social accounts", "30 scheduled posts/month", "Basic analytics", "1 user"],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For growing teams and businesses",
    features: ["15 social accounts", "Unlimited posts", "Advanced analytics", "5 users", "AI assistant", "Priority support"],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations",
    features: ["Unlimited accounts", "Custom integrations", "Dedicated support", "SSO & SAML", "Custom training", "SLA"],
    cta: "Contact Sales",
    popular: false,
  },
];

function PricingPreviewSection() {
  return (
    <section className="section-spacing bg-muted/30 border-y border-border/50" id="pricing">
      <div className="page-container">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background text-sm text-muted-foreground mb-4">
            Pricing
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Start free and scale as you grow. No hidden fees.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative p-6 rounded-xl border bg-card",
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
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="size-4 text-primary shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={cn(
                  "w-full",
                  plan.popular && "bg-gradient-brand text-white border-0"
                )}
                variant={plan.popular ? "default" : "outline"}
                asChild
              >
                <Link to="/pricing">
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

// =============================================================================
// CTA SECTION
// =============================================================================

function CTASection() {
  return (
    <section className="section-spacing">
      <div className="page-container">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-brand p-8 md:p-12 text-center">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
          </div>
          
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to take control of your social presence?
            </h2>
            <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8">
              Join thousands of teams who trust Heimdall to manage their social media strategy.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="h-12 px-8 bg-white text-primary hover:bg-white/90" asChild>
                <Link to="/dashboard">
                  Start Free Trial
                  <ArrowRight className="size-4 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 border-white/30 text-white hover:bg-white/10">
                Schedule a Demo
                <ArrowUpRight className="size-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// HOME PAGE EXPORT
// =============================================================================

export function HomePage() {
  return (
    <>
      <HeroSection />
      <LogoCloudSection />
      <FeaturesSection />
      <StatsSection />
      <TestimonialsSection />
      <PricingPreviewSection />
      <CTASection />
    </>
  );
}
