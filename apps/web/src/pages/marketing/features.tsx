import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Calendar,
  BarChart3,
  Zap,
  Shield,
  Users,
  Sparkles,
  Globe,
  Clock,
  MessageSquare,
  Layers,
  Target,
  RefreshCw,
  Bell,
  Palette,
  Code,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Feature categories
const featureCategories = [
  {
    id: "scheduling",
    title: "Smart Scheduling",
    description: "Optimize your posting times with intelligent scheduling",
    icon: Calendar,
    features: [
      {
        title: "Optimal Time Suggestions",
        description: "AI analyzes your audience activity to suggest the best posting times for maximum engagement.",
        icon: Clock,
      },
      {
        title: "Visual Calendar",
        description: "See all your scheduled content across platforms in one beautiful calendar view.",
        icon: Calendar,
      },
      {
        title: "Queue Management",
        description: "Organize your content queue with drag-and-drop simplicity and bulk scheduling.",
        icon: Layers,
      },
      {
        title: "Time Zone Intelligence",
        description: "Automatically adjust posting times for different audience time zones.",
        icon: Globe,
      },
    ],
  },
  {
    id: "analytics",
    title: "Deep Analytics",
    description: "Understand your performance with actionable insights",
    icon: BarChart3,
    features: [
      {
        title: "Unified Dashboard",
        description: "See metrics from all platforms in a single, comprehensive dashboard.",
        icon: BarChart3,
      },
      {
        title: "Engagement Tracking",
        description: "Monitor likes, comments, shares, and saves across all your content.",
        icon: MessageSquare,
      },
      {
        title: "Audience Insights",
        description: "Understand who your audience is with demographic and behavioral data.",
        icon: Users,
      },
      {
        title: "Competitor Analysis",
        description: "Benchmark your performance against competitors in your industry.",
        icon: Target,
      },
    ],
  },
  {
    id: "automation",
    title: "Automation",
    description: "Save time with powerful workflow automation",
    icon: Zap,
    features: [
      {
        title: "Auto-Publishing",
        description: "Set it and forget it - your content publishes automatically when scheduled.",
        icon: RefreshCw,
      },
      {
        title: "Smart Notifications",
        description: "Get alerted about important events, mentions, and engagement milestones.",
        icon: Bell,
      },
      {
        title: "Content Recycling",
        description: "Automatically reshare your best-performing content at optimal intervals.",
        icon: RefreshCw,
      },
      {
        title: "Workflow Triggers",
        description: "Create custom automation rules based on engagement and time triggers.",
        icon: Zap,
      },
    ],
  },
  {
    id: "collaboration",
    title: "Team Collaboration",
    description: "Work together seamlessly with your team",
    icon: Users,
    features: [
      {
        title: "Approval Workflows",
        description: "Set up review and approval processes before content goes live.",
        icon: Check,
      },
      {
        title: "Role-Based Access",
        description: "Control who can publish, edit, or view content with granular permissions.",
        icon: Shield,
      },
      {
        title: "Content Library",
        description: "Share assets, templates, and approved content across your team.",
        icon: Layers,
      },
      {
        title: "Comments & Notes",
        description: "Leave feedback directly on posts with threaded conversations.",
        icon: MessageSquare,
      },
    ],
  },
  {
    id: "ai",
    title: "AI Assistant",
    description: "Supercharge your content with AI",
    icon: Sparkles,
    features: [
      {
        title: "Caption Generation",
        description: "Get AI-powered caption suggestions tailored to your brand voice.",
        icon: Sparkles,
      },
      {
        title: "Hashtag Research",
        description: "Discover trending and relevant hashtags to maximize reach.",
        icon: Target,
      },
      {
        title: "Content Ideas",
        description: "Never run out of ideas with AI-generated content suggestions.",
        icon: Palette,
      },
      {
        title: "Auto-Translation",
        description: "Reach global audiences with automatic content translation.",
        icon: Globe,
      },
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connect with the tools you already use",
    icon: Code,
    features: [
      {
        title: "Platform Connections",
        description: "Connect Instagram, Twitter, LinkedIn, Facebook, TikTok, and more.",
        icon: Globe,
      },
      {
        title: "Design Tools",
        description: "Import directly from Canva, Figma, and other design platforms.",
        icon: Palette,
      },
      {
        title: "CRM Integration",
        description: "Sync with Salesforce, HubSpot, and other CRM tools.",
        icon: Users,
      },
      {
        title: "API Access",
        description: "Build custom integrations with our comprehensive REST API.",
        icon: Code,
      },
    ],
  },
];

function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent rounded-full blur-3xl -translate-y-1/2" />
      
      <div className="page-container relative">
        <div className="max-w-3xl mx-auto text-center stagger-children">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted text-sm text-muted-foreground mb-6">
            Features
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Powerful features for{" "}
            <span className="text-gradient-brand">modern teams</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-10">
            Everything you need to manage, analyze, and grow your social media presence in one platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="h-12 px-8 bg-gradient-brand text-white border-0 glow">
              <Link to="/dashboard">
                Start Free Trial
                <ArrowRight className="size-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8">
              <Link to="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCategorySection({ category, index }: { category: typeof featureCategories[0]; index: number }) {
  const isReversed = index % 2 === 1;
  
  return (
    <section className={cn("section-spacing-sm", index % 2 === 1 && "bg-muted/30")}>
      <div className="page-container">
        <div className={cn(
          "grid gap-12 lg:gap-16 items-center",
          "lg:grid-cols-2",
          isReversed && "lg:[direction:rtl] lg:*:[direction:ltr]"
        )}>
          {/* Content */}
          <div className="space-y-6">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <category.icon className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-3">{category.title}</h2>
              <p className="text-lg text-muted-foreground">{category.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {category.features.map((feature) => (
                <div key={feature.title} className="flex gap-3">
                  <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <feature.icon className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-0.5">{feature.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual */}
          <div className="relative">
            <div className="aspect-[4/3] rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <div className="p-6 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="size-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs text-muted-foreground">{category.title}</span>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  {category.features.map((feature, i) => (
                    <div 
                      key={feature.title}
                      className="rounded-lg bg-muted/50 p-4 animate-pulse"
                      style={{ animationDelay: `${i * 200}ms` }}
                    >
                      <feature.icon className="size-5 text-primary/60 mb-2" />
                      <div className="h-2 w-3/4 rounded bg-muted" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="section-spacing">
      <div className="page-container">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Ready to get started?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start your free trial today and see how Heimdall can transform your social media strategy.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="h-12 px-8 bg-gradient-brand text-white border-0 glow">
              <Link to="/dashboard">
                Start Free Trial
                <ArrowRight className="size-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8">
              Contact Sales
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeaturesPage() {
  return (
    <>
      <HeroSection />
      {featureCategories.map((category, index) => (
        <FeatureCategorySection key={category.id} category={category} index={index} />
      ))}
      <CTASection />
    </>
  );
}
