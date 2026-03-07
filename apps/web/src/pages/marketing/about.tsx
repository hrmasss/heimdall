import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Eye,
  Heart,
  Shield,
  Zap,
} from "lucide-react";

const values = [
  {
    icon: Eye,
    title: "Clarity",
    description: "We believe in providing clear, actionable insights that empower better decisions.",
  },
  {
    icon: Heart,
    title: "Customer First",
    description: "Every feature we build starts with understanding what our users truly need.",
  },
  {
    icon: Shield,
    title: "Trust",
    description: "We handle your data with the utmost care and transparency.",
  },
  {
    icon: Zap,
    title: "Innovation",
    description: "We're constantly pushing the boundaries of what's possible in social media management.",
  },
];

const team = [
  { name: "Alex Rivera", role: "CEO & Co-Founder", image: null },
  { name: "Jordan Chen", role: "CTO & Co-Founder", image: null },
  { name: "Sam Patel", role: "Head of Product", image: null },
  { name: "Morgan Kim", role: "Head of Design", image: null },
  { name: "Taylor Brooks", role: "Head of Engineering", image: null },
  { name: "Casey Wright", role: "Head of Marketing", image: null },
];

const milestones = [
  { year: "2021", event: "Heimdall founded with a mission to simplify social media management" },
  { year: "2022", event: "Launched public beta with 1,000 early adopters" },
  { year: "2023", event: "Raised Series A funding, expanded to 10,000 teams" },
  { year: "2024", event: "Introduced AI-powered features and reached 50,000 users" },
  { year: "2025", event: "Expanded globally with support for 20+ languages" },
];

function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent rounded-full blur-3xl -translate-y-1/2" />
      
      <div className="page-container relative">
        <div className="max-w-3xl mx-auto text-center stagger-children">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted text-sm text-muted-foreground mb-6">
            About Us
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
            The all-seeing eye for{" "}
            <span className="text-gradient-brand">social media</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed">
            Named after the all-seeing guardian of Asgard in Norse mythology, Heimdall was built 
            to give teams complete visibility and control over their social media presence.
          </p>
        </div>
      </div>
    </section>
  );
}

function MissionSection() {
  return (
    <section className="section-spacing-sm bg-muted/30 border-y border-border/50">
      <div className="page-container">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight mb-6">Our Mission</h2>
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              We're on a mission to democratize social media management. Too many teams struggle 
              with fragmented tools, inconsistent posting, and unclear performance metrics.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Heimdall brings everything together in one powerful, intuitive platform. We believe 
              that great social media management shouldn't require a massive budget or a dedicated 
              team – it should be accessible to everyone.
            </p>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <div className="size-32 rounded-full bg-gradient-brand flex items-center justify-center animate-float">
                <Eye className="size-16 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ValuesSection() {
  return (
    <section className="section-spacing">
      <div className="page-container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Our Values</h2>
          <p className="text-lg text-muted-foreground">
            The principles that guide everything we do
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value) => (
            <div key={value.title} className="p-6 rounded-xl border bg-card text-center">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <value.icon className="size-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
              <p className="text-sm text-muted-foreground">{value.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TimelineSection() {
  return (
    <section className="section-spacing-sm bg-muted/30 border-y border-border/50">
      <div className="page-container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Our Journey</h2>
          <p className="text-lg text-muted-foreground">
            From a simple idea to a platform trusted by thousands
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-border" />
            
            <div className="space-y-8">
              {milestones.map((milestone) => (
                <div key={milestone.year} className="relative flex gap-6">
                  <div className="size-16 rounded-full bg-card border-2 border-primary flex items-center justify-center shrink-0 z-10">
                    <span className="text-sm font-bold text-primary">{milestone.year}</span>
                  </div>
                  <div className="pt-4">
                    <p className="text-foreground">{milestone.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TeamSection() {
  return (
    <section className="section-spacing">
      <div className="page-container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Meet the Team</h2>
          <p className="text-lg text-muted-foreground">
            The people behind Heimdall
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
          {team.map((member) => (
            <div key={member.name} className="p-6 rounded-xl border bg-card text-center">
              <div className="size-20 rounded-full bg-gradient-brand flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
                {member.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <h3 className="font-semibold mb-1">{member.name}</h3>
              <p className="text-sm text-muted-foreground">{member.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="section-spacing-sm">
      <div className="page-container">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-brand p-8 md:p-12 text-center">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
          </div>
          
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Join us on our mission
            </h2>
            <p className="text-white/80 text-lg max-w-xl mx-auto mb-8">
              We're always looking for talented people who share our passion for building great products.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="h-12 px-8 bg-white text-primary hover:bg-white/90" asChild>
                <Link to="/careers">
                  View Open Positions
                  <ArrowRight className="size-4 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 border-white/30 text-white hover:bg-white/10" asChild>
                <Link to="/contact">
                  Get in Touch
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AboutPage() {
  return (
    <>
      <HeroSection />
      <MissionSection />
      <ValuesSection />
      <TimelineSection />
      <TeamSection />
      <CTASection />
    </>
  );
}
