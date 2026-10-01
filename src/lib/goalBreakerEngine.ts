import { GATE_CATEGORIES, GATE_100_SUBTASKS, type SubtaskCategory, type CuratedSubtask } from "./gateCurriculum";

export type GoalMilestonePhase = {
  id: string;
  name: string;
  duration: string;
  focus: string;
  color: string;
  categoryIds: string[];
};

export type GoalResource = {
  title: string;
  channel: string;
  duration: string;
  why: string;
  url: string;
};

export type GoalBreakdown = {
  id: string;
  goal: string;
  topic: string;
  timeline: string;
  summary: string;
  phases: GoalMilestonePhase[];
  categories: SubtaskCategory[];
  subtasks: CuratedSubtask[];
  resources: GoalResource[];
};

/**
 * Extracts a clean, professional goal title/topic from natural user inputs.
 * E.g.: "Help me prepare for gate exam - Make this as a long term goal" -> "GATE Computer Science & IT"
 * E.g.: "I want to become a billionaire and launch a tech startup" -> "Tech Startup & Wealth Building"
 */
export function extractGoalTopic(input: string): string {
  let clean = input.trim();

  // Strip prefixes
  clean = clean.replace(/^(?:hey\s+orbit|orbit|can\s+you|please|i\s+want\s+to|i\s+need\s+to|help\s+me|how\s+to)\s+/i, "");
  clean = clean.replace(/^(?:prepare\s+for|study\s+for|break\s+down|give\s+me\s+a\s+plan\s+for|roadmap\s+for|plan\s+for|master|learn|start|crack)\s+/i, "");
  
  // Strip trailing instructions like "make this as a long term goal", "add to goals", etc.
  clean = clean.replace(/[-–—]?\s*(?:make\s+this\s+(?:as\s+)?(?:a\s+)?(?:long\s*term\s+)?goal|add\s+(?:this\s+)?(?:to\s+)?(?:active\s+)?goals?|track\s+(?:this\s+)?(?:as\s+)?(?:a\s+)?goal|flowchart|in\s+orbit).*$/i, "");
  clean = clean.replace(/[.?!,]+$/, "").trim();

  if (!clean || clean.length < 2) return "Strategic Goal";

  // Check common domain matches to normalize title
  if (/gate|engineering\s+exam/i.test(clean)) return "GATE Computer Science & IT";
  if (/billionaire|startup|wealth|venture|founder|saas|business/i.test(clean)) return "Tech Startup & Wealth Building";
  if (/dsa|data\s+structures|leetcode|algorithm|coding\s+interview/i.test(clean)) return "Data Structures & Algorithms";
  if (/full\s*stack|web\s*dev|react|frontend|backend|next\.?js/i.test(clean)) return "Full Stack Web Development";
  if (/machine\s*learning|deep\s*learning|ai|artificial\s*intelligence|data\s*science/i.test(clean)) return "Machine Learning & AI Engineering";
  if (/upsc|civil\s*services|ias|ips/i.test(clean)) return "UPSC Civil Services Examination";
  if (/devops|cloud|kubernetes|docker|aws/i.test(clean)) return "Cloud & DevOps Engineering";
  if (/stock\s*market|investing|trading|day\s*trading/i.test(clean)) return "Financial Markets & Trading";

  // Capitalize title
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// ==========================================
// PRESET CURRICULUM ARCHITECTURES
// ==========================================

function getGateCurriculum(): GoalBreakdown {
  return {
    id: "gate-cs",
    goal: "GATE Computer Science & IT",
    topic: "GATE CS",
    timeline: "6–9 Months (250+ Hours)",
    summary:
      "A structured 110-step curriculum for GATE CS & IT. The proven strategy prioritizes high-weightage subjects: Engineering Mathematics & Aptitude (28 marks) + Core Systems (OS, DBMS, CN, TOC) (45 marks). Decomposed into 5 milestone phases with verified lecture playlists from Gate Smashers, Knowledge Gate, and NPTEL.",
    phases: [
      {
        id: "m1",
        name: "Phase 1: High-Weight Foundations",
        duration: "Months 1–2",
        focus: "Engineering Mathematics & Discrete Structures (21 Steps · 15% Weight)",
        color: "#6366f1",
        categoryIds: ["em", "dm"],
      },
      {
        id: "m2",
        name: "Phase 2: Core Engineering Systems",
        duration: "Months 3–4",
        focus: "Operating Systems, DBMS & Computer Networks (30 Steps · 25% Weight)",
        color: "#38bdf8",
        categoryIds: ["os", "dbms", "cn"],
      },
      {
        id: "m3",
        name: "Phase 3: Algorithms & Code Mastery",
        duration: "Months 5–6",
        focus: "Data Structures, Algorithms & Digital Logic (22 Steps · 20% Weight)",
        color: "#10b981",
        categoryIds: ["dsa", "coa"],
      },
      {
        id: "m4",
        name: "Phase 4: Theoretical CS & Automata",
        duration: "Months 7–8",
        focus: "Theory of Computation & Compiler Design (21 Steps · 18% Weight)",
        color: "#f59e0b",
        categoryIds: ["toc", "compiler"],
      },
      {
        id: "m5",
        name: "Phase 5: Diagnostic Mocks & PYQs",
        duration: "Month 9",
        focus: "GateOverflow PYQ Analysis & Timed Virtual Mocks (16 Steps · Final Sprint)",
        color: "#ec4899",
        categoryIds: ["mocks"],
      },
    ],
    categories: GATE_CATEGORIES,
    subtasks: GATE_100_SUBTASKS,
    resources: [
      {
        title: "GATE Operating Systems Complete Playlist",
        channel: "Gate Smashers",
        duration: "Full Course",
        why: "Varun Singla's series covering OS, DBMS, TOC, and CN with exam-oriented shortcuts.",
        url: "https://www.youtube.com/results?search_query=gate+smashers+operating+system+playlist",
      },
      {
        title: "GATE Discrete Mathematics & Algorithms",
        channel: "Knowledge Gate",
        duration: "Full Playlist",
        why: "Sanchit Jain's step-by-step rigorous breakdown of discrete math, graphs, and algorithm time complexity.",
        url: "https://www.youtube.com/results?search_query=knowledge+gate+discrete+mathematics",
      },
      {
        title: "NPTEL GATE Computer Science Core",
        channel: "NPTEL-NOC IITM",
        duration: "University Lectures",
        why: "In-depth standard theoretical lectures taught by IIT professors mapped to official GATE standards.",
        url: "https://www.youtube.com/results?search_query=nptel+gate+computer+science",
      },
      {
        title: "GateOverflow PYQ Solutions & Practice",
        channel: "Gate Overflow",
        duration: "Community Portal",
        why: "Every single GATE question from 2000–2025 categorized topic-wise with verified explanations.",
        url: "https://gateoverflow.in",
      },
    ],
  };
}

function getBillionaireCurriculum(): GoalBreakdown {
  const categories: SubtaskCategory[] = [
    {
      id: "product",
      name: "Product & Market Validation",
      shortName: "Product",
      icon: "🚀",
      description: "Problem discovery, customer interviews, MVP prototyping, and finding Product-Market Fit",
      color: "#6366f1",
    },
    {
      id: "distribution",
      name: "Distribution & Cold Outreach",
      shortName: "Sales",
      icon: "📈",
      description: "First 100 paying customers, outbound email pipelines, SEO content, and viral distribution flywheels",
      color: "#38bdf8",
    },
    {
      id: "economics",
      name: "Unit Economics & Fundraising",
      shortName: "Finance",
      icon: "💰",
      description: "CAC/LTV ratios, gross margins, cashflow management, pitch decks, and venture capital rounds",
      color: "#10b981",
    },
    {
      id: "scale",
      name: "Moats, Leverage & Global Scale",
      shortName: "Scale",
      icon: "🌐",
      description: "Network effects, high-leverage hiring, automated operations, enterprise licensing, and equity wealth",
      color: "#f59e0b",
    },
  ];

  const subtasks: CuratedSubtask[] = [
    // Product & Validation
    {
      id: "bil-1",
      title: "Identify a bleeding-neck B2B problem and conduct 20 customer discovery interviews (The Mom Test framework)",
      categoryId: "product",
      categoryName: "Product & Market Validation",
      status: "pending",
      weight: "Essential Foundation",
      resource: {
        title: "How to Talk to Users (The Mom Test) — Rob Fitzpatrick",
        type: "youtube",
        creator: "Y Combinator",
        url: "https://www.youtube.com/results?search_query=y+combinator+how+to+talk+to+users",
        badge: "YC Lecture ↗",
      },
    },
    {
      id: "bil-2",
      title: "Map competitive landscape and define your proprietary 10x 'Secret' advantage (Peter Thiel Zero to One)",
      categoryId: "product",
      categoryName: "Product & Market Validation",
      status: "pending",
      weight: "Strategic Moat",
      resource: {
        title: "Competition is for Losers — Peter Thiel at Stanford CS183B",
        type: "youtube",
        creator: "Stanford University",
        url: "https://www.youtube.com/results?search_query=peter+thiel+competition+is+for+losers+stanford",
        badge: "Stanford ↗",
      },
    },
    {
      id: "bil-3",
      title: "Build and ship an MVP in under 14 days using Next.js, Supabase, and Stripe checkout",
      categoryId: "product",
      categoryName: "Product & Market Validation",
      status: "pending",
      weight: "Core Execution",
      resource: {
        title: "How to Build an MVP Quickly — Michael Seibel",
        type: "youtube",
        creator: "Y Combinator",
        url: "https://www.youtube.com/results?search_query=y+combinator+how+to+build+an+mvp",
        badge: "YC Guide ↗",
      },
    },
    {
      id: "bil-4",
      title: "Setup PostHog / Mixpanel telemetry to track activation rate, daily active users, and onboarding drop-offs",
      categoryId: "product",
      categoryName: "Product & Market Validation",
      status: "pending",
      weight: "Data Telemetry",
      resource: {
        title: "Measuring Product Market Fit with Retention Curves",
        type: "youtube",
        creator: "Lenny's Podcast",
        url: "https://www.youtube.com/results?search_query=measuring+product+market+fit+lennys+podcast",
        badge: "Framework ↗",
      },
    },
    {
      id: "bil-5",
      title: "Formulate your Grand Slam Offer: high perceived value, zero friction, and risk reversal guarantee",
      categoryId: "product",
      categoryName: "Product & Market Validation",
      status: "pending",
      weight: "Offer Design",
      resource: {
        title: "$100M Offers Value Equation Breakdown",
        type: "youtube",
        creator: "Alex Hormozi",
        url: "https://www.youtube.com/results?search_query=alex+hormozi+100m+offers+value+equation",
        badge: "Masterclass ↗",
      },
    },

    // Distribution & Sales
    {
      id: "bil-6",
      title: "Manually recruit your first 10 paying customers through hyper-personalized LinkedIn and cold email outreach",
      categoryId: "distribution",
      categoryName: "Distribution & Cold Outreach",
      status: "pending",
      weight: "High Yield · 0 to 1",
      resource: {
        title: "Do Things That Don't Scale — Paul Graham",
        type: "youtube",
        creator: "Y Combinator Startup School",
        url: "https://www.youtube.com/results?search_query=y+combinator+do+things+that+dont+scale",
        badge: "YC Lecture ↗",
      },
    },
    {
      id: "bil-7",
      title: "Build automated cold outbound pipeline with Apollo.io and Instantly with warmed-up secondary domains",
      categoryId: "distribution",
      categoryName: "Distribution & Cold Outreach",
      status: "pending",
      weight: "Outbound Scale",
      resource: {
        title: "Cold Email B2B Lead Generation Masterclass",
        type: "youtube",
        creator: "Liam Ottley / Alex Berman",
        url: "https://www.youtube.com/results?search_query=cold+email+b2b+lead+generation+instantly+apollo",
        badge: "Tutorial ↗",
      },
    },
    {
      id: "bil-8",
      title: "Master high-ticket B2B sales demo closes: SPIN selling framework and objection handling",
      categoryId: "distribution",
      categoryName: "Distribution & Cold Outreach",
      status: "pending",
      weight: "Closing Deals",
      resource: {
        title: "How to Close Enterprise SaaS Deals",
        type: "youtube",
        creator: "SaaStr",
        url: "https://www.youtube.com/results?search_query=saastr+how+to+close+enterprise+saas+deals",
        badge: "SaaStr ↗",
      },
    },
    {
      id: "bil-9",
      title: "Create programmatic SEO landing pages targeting high-intent long-tail keywords",
      categoryId: "distribution",
      categoryName: "Distribution & Cold Outreach",
      status: "pending",
      weight: "Inbound Flywheel",
      resource: {
        title: "Programmatic SEO for SaaS Founders",
        type: "youtube",
        creator: "Ahrefs / Julian Shapiro",
        url: "https://www.youtube.com/results?search_query=programmatic+seo+for+saas",
        badge: "Growth Guide ↗",
      },
    },
    {
      id: "bil-10",
      title: "Establish a public founder brand and build in public on X / Twitter & LinkedIn to drive zero-CAC traffic",
      categoryId: "distribution",
      categoryName: "Distribution & Cold Outreach",
      status: "pending",
      weight: "Media Leverage",
      resource: {
        title: "How to Get Rich (Without Getting Lucky) — Permissionless Leverage",
        type: "youtube",
        creator: "Naval Ravikant",
        url: "https://www.youtube.com/results?search_query=naval+ravikant+how+to+get+rich+podcast",
        badge: "Philosophy ↗",
      },
    },

    // Economics & Capital
    {
      id: "bil-11",
      title: "Audit unit economics: calculate Customer Acquisition Cost (CAC), Lifetime Value (LTV), and Payback Period (<6 mos)",
      categoryId: "economics",
      categoryName: "Unit Economics & Fundraising",
      status: "pending",
      weight: "Financial Viability",
      resource: {
        title: "SaaS Metrics 2.0: A Guide to Measuring and Improving What Matters",
        type: "youtube",
        creator: "David Skok (Matrix Partners)",
        url: "https://www.youtube.com/results?search_query=saas+metrics+2.0+david+skok",
        badge: "Framework ↗",
      },
    },
    {
      id: "bil-12",
      title: "Build a 3-statement financial forecast model with runway projections and cash-flow breakeven milestones",
      categoryId: "economics",
      categoryName: "Unit Economics & Fundraising",
      status: "pending",
      weight: "Financial Modeling",
      resource: {
        title: "Financial Modeling for Startups & Founders",
        type: "youtube",
        creator: "Slidebean / Wall Street Prep",
        url: "https://www.youtube.com/results?search_query=financial+model+for+startups+slidebean",
        badge: "Financial Model ↗",
      },
    },
    {
      id: "bil-13",
      title: "Create a standard 12-slide Seed/Series A investor deck following Sequoia Capital's proven pitch structure",
      categoryId: "economics",
      categoryName: "Unit Economics & Fundraising",
      status: "pending",
      weight: "Fundraising",
      resource: {
        title: "How to Design a Pitch Deck that Raised $20M+",
        type: "youtube",
        creator: "Y Combinator",
        url: "https://www.youtube.com/results?search_query=y+combinator+how+to+design+a+pitch+deck",
        badge: "YC Guide ↗",
      },
    },
    {
      id: "bil-14",
      title: "Structure SAFE agreements, cap table allocations, founder 4-year vesting schedules, and 83(b) tax elections",
      categoryId: "economics",
      categoryName: "Unit Economics & Fundraising",
      status: "pending",
      weight: "Legal Architecture",
      resource: {
        title: "Understanding SAFEs and Cap Table Math",
        type: "youtube",
        creator: "Clerky / Y Combinator",
        url: "https://www.youtube.com/results?search_query=y+combinator+understanding+safes+cap+tables",
        badge: "Legal Guide ↗",
      },
    },

    // Scale & Moats
    {
      id: "bil-15",
      title: "Engineer network effects or high switching costs so retention naturally trends toward >115% Net Revenue Retention (NRR)",
      categoryId: "scale",
      categoryName: "Moats, Leverage & Global Scale",
      status: "pending",
      weight: "Compounding Moat",
      resource: {
        title: "The 7 Powers: The Foundations of Business Strategy",
        type: "youtube",
        creator: "Hamilton Helmer (Acquired Podcast)",
        url: "https://www.youtube.com/results?search_query=hamilton+helmer+7+powers+acquired+podcast",
        badge: "Strategy ↗",
      },
    },
    {
      id: "bil-16",
      title: "Hire your first 3 A-player engineers and operators with competitive equity packages and rigorous work trials",
      categoryId: "scale",
      categoryName: "Moats, Leverage & Global Scale",
      status: "pending",
      weight: "Team Leverage",
      resource: {
        title: "How to Hire Your First 10 Employees",
        type: "youtube",
        creator: "Patrick Collison (Stripe)",
        url: "https://www.youtube.com/results?search_query=patrick+collison+how+to+hire+first+employees",
        badge: "Stripe ↗",
      },
    },
    {
      id: "bil-17",
      title: "Automate internal operations and customer onboarding into self-serve workflows to maintain 85%+ gross margins",
      categoryId: "scale",
      categoryName: "Moats, Leverage & Global Scale",
      status: "pending",
      weight: "Operational Efficiency",
      resource: {
        title: "Scaling Operations and Systems Thinking",
        type: "youtube",
        creator: "Sam Altman (Stanford CS183)",
        url: "https://www.youtube.com/results?search_query=sam+altman+stanford+cs183+lecture",
        badge: "Stanford ↗",
      },
    },
    {
      id: "bil-18",
      title: "Establish holding company structure and tax-advantaged asset protection strategies for founder equity",
      categoryId: "scale",
      categoryName: "Moats, Leverage & Global Scale",
      status: "pending",
      weight: "Wealth Preservation",
      resource: {
        title: "Billionaire Tax & Wealth Structuring Masterclass",
        type: "youtube",
        creator: "Toby Mathis / Anderson Advisors",
        url: "https://www.youtube.com/results?search_query=holding+company+asset+protection+tax+strategy",
        badge: "Mastery ↗",
      },
    },
  ];

  return {
    id: "billionaire-startup",
    goal: "Tech Startup & Wealth Building",
    topic: "Billionaire & Startup Founder",
    timeline: "12–24 Months (Iterative Sprint)",
    summary:
      "A comprehensive blueprint for building high-equity enterprise value and generational wealth. The proven pathway emphasizes problem validation (The Mom Test) → rapid MVP shipping (14-day cycle) → repeatable outbound distribution → pristine unit economics (LTV/CAC > 3) → capital leverage and durable compounding moats.",
    phases: [
      {
        id: "p1",
        name: "Phase 1: Validation & Zero-to-One Product",
        duration: "Weeks 1–6",
        focus: "Problem discovery, customer interviews, rapid MVP prototyping, and offer architecture",
        color: "#6366f1",
        categoryIds: ["product"],
      },
      {
        id: "p2",
        name: "Phase 2: Distribution & Outbound Engine",
        duration: "Weeks 7–16",
        focus: "First 100 paying customers, automated cold outbound, B2B sales closing, and content flywheels",
        color: "#38bdf8",
        categoryIds: ["distribution"],
      },
      {
        id: "p3",
        name: "Phase 3: Unit Economics & Capitalization",
        duration: "Weeks 17–28",
        focus: "LTV/CAC optimization, runway modeling, Sequoia pitch deck, and Seed/Series A fundraising",
        color: "#10b981",
        categoryIds: ["economics"],
      },
      {
        id: "p4",
        name: "Phase 4: Compounding Moats & Global Scale",
        duration: "Weeks 29–52",
        focus: "Network effects, high-leverage hiring, automated ops, enterprise sales, and equity wealth preservation",
        color: "#f59e0b",
        categoryIds: ["scale"],
      },
    ],
    categories,
    subtasks,
    resources: [
      {
        title: "Y Combinator Startup School",
        channel: "Y Combinator",
        duration: "Complete Curriculum",
        why: "The definitive guide on finding ideas, building MVPs, talking to users, and raising capital from top YC partners.",
        url: "https://www.youtube.com/results?search_query=y+combinator+startup+school+complete+playlist",
      },
      {
        title: "$100M Offers & Lead Generation",
        channel: "Alex Hormozi",
        duration: "Masterclass Series",
        why: "Step-by-step frameworks for crafting irresistible offers, cold outreach, and scaling B2B client acquisition.",
        url: "https://www.youtube.com/results?search_query=alex+hormozi+100m+offers+full+course",
      },
      {
        title: "How to Get Rich (Without Getting Lucky)",
        channel: "Naval Ravikant",
        duration: "Audio Masterpiece",
        why: "Principles of specific knowledge, permissionless code and media leverage, and judgment-based compounding.",
        url: "https://www.youtube.com/results?search_query=naval+ravikant+how+to+get+rich+full+podcast",
      },
      {
        title: "Competition is for Losers (Stanford CS183)",
        channel: "Peter Thiel",
        duration: "University Lecture",
        why: "How to avoid commodity competition, escape price wars, and build a lasting monopoly.",
        url: "https://www.youtube.com/results?search_query=peter+thiel+stanford+lecture+competition+is+for+losers",
      },
    ],
  };
}

function getDsaCurriculum(): GoalBreakdown {
  const categories: SubtaskCategory[] = [
    {
      id: "linear",
      name: "Arrays, Hashing & Pointers",
      shortName: "Arrays",
      icon: "⚡",
      description: "Time/Space Complexity, Sliding Window, Two Pointers, Binary Search, and Prefix Sums",
      color: "#6366f1",
    },
    {
      id: "trees",
      name: "Trees, Graphs & Backtracking",
      shortName: "Trees & Graphs",
      icon: "🌲",
      description: "Binary Trees, BSTs, Heaps/Tries, BFS/DFS, Topological Sort, and Dijkstra's algorithm",
      color: "#38bdf8",
    },
    {
      id: "dp",
      name: "Dynamic Programming & Greedy",
      shortName: "DP & Greedy",
      icon: "🧠",
      description: "1D/2D memoization, knapsack variants, longest common subsequence, and greedy intervals",
      color: "#10b981",
    },
    {
      id: "sys",
      name: "System Design & Interview Mocks",
      shortName: "Interviews",
      icon: "🏛️",
      description: "Scale from 1 to 10M users, cache strategies, DB sharding, and live timed mock assessments",
      color: "#f59e0b",
    },
  ];

  const subtasks: CuratedSubtask[] = [
    {
      id: "dsa-1",
      title: "Master Asymptotic Notations (Big-O, Omega, Theta) and analyze recursion tree depth",
      categoryId: "linear",
      categoryName: "Arrays, Hashing & Pointers",
      status: "pending",
      weight: "Foundational Math",
      resource: {
        title: "Algorithms Analysis & Asymptotic Notation",
        type: "youtube",
        creator: "Abdul Bari",
        url: "https://www.youtube.com/results?search_query=abdul+bari+algorithms+time+complexity",
        badge: "Essential ↗",
      },
    },
    {
      id: "dsa-2",
      title: "Solve NeetCode Arrays & Hashing pattern: Two Sum, Valid Anagram, Group Anagrams, Top K Frequent",
      categoryId: "linear",
      categoryName: "Arrays, Hashing & Pointers",
      status: "pending",
      weight: "Core Pattern",
      resource: {
        title: "NeetCode 150 Arrays & Hashing Playlist",
        type: "youtube",
        creator: "NeetCode",
        url: "https://www.youtube.com/results?search_query=neetcode+arrays+and+hashing",
        badge: "Visual Code ↗",
      },
    },
    {
      id: "dsa-3",
      title: "Implement Two Pointers & Sliding Window techniques (3Sum, Container With Most Water, Min Window Substring)",
      categoryId: "linear",
      categoryName: "Arrays, Hashing & Pointers",
      status: "pending",
      weight: "High Yield",
      resource: {
        title: "Sliding Window Algorithm Explained",
        type: "youtube",
        creator: "NeetCode",
        url: "https://www.youtube.com/results?search_query=neetcode+sliding+window+technique",
        badge: "Pattern ↗",
      },
    },
    {
      id: "dsa-4",
      title: "Master Binary Search variants: Search in Rotated Sorted Array and Find Minimum in Rotated Array",
      categoryId: "linear",
      categoryName: "Arrays, Hashing & Pointers",
      status: "pending",
      weight: "O(log N) Mastery",
      resource: {
        title: "Binary Search Deep-Dive & Edge Cases",
        type: "youtube",
        creator: "take U forward (Striver)",
        url: "https://www.youtube.com/results?search_query=striver+binary+search+playlist",
        badge: "Masterclass ↗",
      },
    },
    {
      id: "dsa-5",
      title: "Binary Tree Traversals (Inorder, Preorder, Postorder, Level Order BFS) iteratively and recursively",
      categoryId: "trees",
      categoryName: "Trees, Graphs & Backtracking",
      status: "pending",
      weight: "Core Tree Logic",
      resource: {
        title: "Binary Tree Series — All Traversals",
        type: "youtube",
        creator: "take U forward (Striver)",
        url: "https://www.youtube.com/results?search_query=striver+binary+trees+playlist",
        badge: "Full Series ↗",
      },
    },
    {
      id: "dsa-6",
      title: "Implement Binary Search Tree validation, lowest common ancestor, and balanced AVL rotation logic",
      categoryId: "trees",
      categoryName: "Trees, Graphs & Backtracking",
      status: "pending",
      weight: "BST Properties",
      resource: {
        title: "AVL Trees & BST Operations Visually Explained",
        type: "youtube",
        creator: "Abdul Bari",
        url: "https://www.youtube.com/results?search_query=abdul+bari+avl+trees",
        badge: "Conceptual ↗",
      },
    },
    {
      id: "dsa-7",
      title: "Graph Representation (Adjacency Matrix vs List), BFS, DFS, and Cycle Detection in directed/undirected graphs",
      categoryId: "trees",
      categoryName: "Trees, Graphs & Backtracking",
      status: "pending",
      weight: "Crucial Interview Topic",
      resource: {
        title: "Graph Series for Coding Interviews",
        type: "youtube",
        creator: "take U forward (Striver)",
        url: "https://www.youtube.com/results?search_query=striver+graph+series+playlist",
        badge: "Complete ↗",
      },
    },
    {
      id: "dsa-8",
      title: "Topological Sort (Kahn's Algorithm BFS & DFS) and Dijkstra's Shortest Path Algorithm using Priority Queues",
      categoryId: "trees",
      categoryName: "Trees, Graphs & Backtracking",
      status: "pending",
      weight: "Advanced Graph",
      resource: {
        title: "Dijkstra's Algorithm Step-by-Step",
        type: "youtube",
        creator: "Abdul Bari",
        url: "https://www.youtube.com/results?search_query=abdul+bari+dijkstras+algorithm",
        badge: "Visual ↗",
      },
    },
    {
      id: "dsa-9",
      title: "Understand 1D Dynamic Programming: Climbing Stairs, House Robber, Coin Change, and Longest Increasing Subsequence",
      categoryId: "dp",
      categoryName: "Dynamic Programming & Greedy",
      status: "pending",
      weight: "High Frequency",
      resource: {
        title: "Dynamic Programming Playlist (Recursion to Memoization to Tabulation)",
        type: "youtube",
        creator: "NeetCode",
        url: "https://www.youtube.com/results?search_query=neetcode+dynamic+programming+1d",
        badge: "Patterns ↗",
      },
    },
    {
      id: "dsa-10",
      title: "Solve 2D DP Classics: 0/1 Knapsack, Longest Common Subsequence (LCS), and Edit Distance",
      categoryId: "dp",
      categoryName: "Dynamic Programming & Greedy",
      status: "pending",
      weight: "Hard Category",
      resource: {
        title: "0/1 Knapsack Problem Dynamic Programming",
        type: "youtube",
        creator: "Abdul Bari",
        url: "https://www.youtube.com/results?search_query=abdul+bari+knapsack+dynamic+programming",
        badge: "Deep-Dive ↗",
      },
    },
    {
      id: "dsa-11",
      title: "System Design Fundamentals: Vertical vs Horizontal Scaling, Load Balancers, Consistent Hashing, and Caching",
      categoryId: "sys",
      categoryName: "System Design & Interview Mocks",
      status: "pending",
      weight: "Senior Engineer Bar",
      resource: {
        title: "System Design Primer & Distributed Systems",
        type: "youtube",
        creator: "Gaurav Sen",
        url: "https://www.youtube.com/results?search_query=gaurav+sen+system+design+playlist",
        badge: "System Design ↗",
      },
    },
    {
      id: "dsa-12",
      title: "Complete 5 timed live mock interviews on Pramp / Interviewing.io under 45-minute strict constraints",
      categoryId: "sys",
      categoryName: "System Design & Interview Mocks",
      status: "pending",
      weight: "Interview Readiness",
      resource: {
        title: "How to Ace the FAANG Coding Interview",
        type: "youtube",
        creator: "Clément Mihailescu",
        url: "https://www.youtube.com/results?search_query=clement+mihailescu+mock+coding+interview",
        badge: "Mock Interview ↗",
      },
    },
  ];

  return {
    id: "dsa-mastery",
    goal: "Data Structures & Algorithms Mastery",
    topic: "DSA & LeetCode",
    timeline: "3–4 Months (150+ Hours)",
    summary:
      "A pattern-oriented roadmap for conquering coding interviews. Stop grinding 800 random LeetCode problems blindly; instead master the 14 core repeatable algorithmic templates: Two Pointers, Sliding Window, Fast/Slow Pointers, Tree BFS/DFS, Backtracking, and DP state transitions.",
    phases: [
      {
        id: "p1",
        name: "Phase 1: Complexity, Arrays & Hashing Patterns",
        duration: "Weeks 1–4",
        focus: "Time/Space analysis, Two Pointers, Sliding Window, Prefix Sums, and Binary Search",
        color: "#6366f1",
        categoryIds: ["linear"],
      },
      {
        id: "p2",
        name: "Phase 2: Trees, Graphs & Recursion",
        duration: "Weeks 5–8",
        focus: "Binary Search Trees, Heaps, Graph BFS/DFS, Topological Sort, and Backtracking",
        color: "#38bdf8",
        categoryIds: ["trees"],
      },
      {
        id: "p3",
        name: "Phase 3: Dynamic Programming & Greedy",
        duration: "Weeks 9–12",
        focus: "1D/2D memoization tables, Knapsack, LCS, Edit Distance, and interval scheduling",
        color: "#10b981",
        categoryIds: ["dp"],
      },
      {
        id: "p4",
        name: "Phase 4: System Design & Timed Mock Assessments",
        duration: "Weeks 13–16",
        focus: "Scalability, caching, consistent hashing, database indexing, and behavioral/coding mocks",
        color: "#f59e0b",
        categoryIds: ["sys"],
      },
    ],
    categories,
    subtasks,
    resources: [
      {
        title: "Algorithms Masterclass",
        channel: "Abdul Bari",
        duration: "Comprehensive Series",
        why: "Visual, mathematical intuition for asymptotic complexity, sorting, divide & conquer, and dynamic programming.",
        url: "https://www.youtube.com/results?search_query=abdul+bari+algorithms+playlist",
      },
      {
        title: "NeetCode 150 Coding Interview Guide",
        channel: "NeetCode",
        duration: "Pattern Video Guide",
        why: "Clean Python solutions and visual pattern matching for top tech interview questions.",
        url: "https://www.youtube.com/results?search_query=neetcode+150+complete+playlist",
      },
      {
        title: "A2Z DSA Sheet Roadmap",
        channel: "take U forward (Striver)",
        duration: "Zero to Hero Playlist",
        why: "Structured progression through arrays, trees, graphs, and dynamic programming with step-by-step notes.",
        url: "https://www.youtube.com/results?search_query=striver+a2z+dsa+course+playlist",
      },
      {
        title: "System Design for Software Engineers",
        channel: "Gaurav Sen",
        duration: "Core Concepts",
        why: "Distributed systems, caching, microservices architecture, and high-availability patterns.",
        url: "https://www.youtube.com/results?search_query=gaurav+sen+system+design",
      },
    ],
  };
}

function getWebDevCurriculum(): GoalBreakdown {
  const categories: SubtaskCategory[] = [
    {
      id: "fe",
      name: "Frontend & React Architecture",
      shortName: "Frontend",
      icon: "⚛️",
      description: "TypeScript, React 19, Next.js App Router, Tailwind CSS, State Management, and Performance",
      color: "#38bdf8",
    },
    {
      id: "be",
      name: "Backend, APIs & Auth",
      shortName: "Backend",
      icon: "⚙️",
      description: "Node.js, Express, RESTful APIs, GraphQL, JWT/OAuth authentication, and WebSockets",
      color: "#10b981",
    },
    {
      id: "db",
      name: "Databases & Data Modeling",
      shortName: "Databases",
      icon: "🗄️",
      description: "PostgreSQL, Prisma/Drizzle ORM, indexing, ACID transactions, migrations, and Redis caching",
      color: "#a855f7",
    },
    {
      id: "devops",
      name: "DevOps, Cloud & Production",
      shortName: "DevOps",
      icon: "☁️",
      description: "Docker containerization, CI/CD GitHub Actions, Vercel/AWS deployment, and monitoring",
      color: "#f59e0b",
    },
  ];

  const subtasks: CuratedSubtask[] = [
    {
      id: "web-1",
      title: "Master TypeScript Generics, Utility Types (Pick, Omit, Record), and Type Narrowing",
      categoryId: "fe",
      categoryName: "Frontend & React Architecture",
      status: "pending",
      weight: "Core Foundation",
      resource: {
        title: "TypeScript Full Course for Beginners",
        type: "youtube",
        creator: "freeCodeCamp",
        url: "https://www.youtube.com/results?search_query=freecodecamp+typescript+course",
        badge: "Tutorial ↗",
      },
    },
    {
      id: "web-2",
      title: "Master React 19 hooks, Server Components (RSC), Suspense boundaries, and Server Actions",
      categoryId: "fe",
      categoryName: "Frontend & React Architecture",
      status: "pending",
      weight: "Modern Standard",
      resource: {
        title: "React 19 & Next.js 15 Full Course",
        type: "youtube",
        creator: "Jack Herrington",
        url: "https://www.youtube.com/results?search_query=jack+herrington+react+19+nextjs+15",
        badge: "Deep-Dive ↗",
      },
    },
    {
      id: "web-3",
      title: "Build responsive, accessible UI layouts with Tailwind CSS, Radix UI primitives, and Framer Motion",
      categoryId: "fe",
      categoryName: "Frontend & React Architecture",
      status: "pending",
      weight: "UI Craftsmanship",
      resource: {
        title: "Tailwind CSS & Framer Motion Masterclass",
        type: "youtube",
        creator: "Traversy Media / PedroTech",
        url: "https://www.youtube.com/results?search_query=tailwind+css+framer+motion+modern+ui",
        badge: "UI Tutorial ↗",
      },
    },
    {
      id: "web-4",
      title: "Design scalable REST APIs with Node.js, Express, input validation with Zod, and rate-limiting",
      categoryId: "be",
      categoryName: "Backend, APIs & Auth",
      status: "pending",
      weight: "API Design",
      resource: {
        title: "Node.js and Express Full Course with Best Practices",
        type: "youtube",
        creator: "Dave Gray",
        url: "https://www.youtube.com/results?search_query=dave+gray+nodejs+express+full+course",
        badge: "Full Course ↗",
      },
    },
    {
      id: "web-5",
      title: "Implement secure authentication with Lucia Auth / NextAuth / Supabase Auth, HTTP-only JWTs and OAuth",
      categoryId: "be",
      categoryName: "Backend, APIs & Auth",
      status: "pending",
      weight: "Security Critical",
      resource: {
        title: "Modern Web Authentication & Security Guide",
        type: "youtube",
        creator: "Web Dev Simplified",
        url: "https://www.youtube.com/results?search_query=web+dev+simplified+jwt+auth+guide",
        badge: "Security ↗",
      },
    },
    {
      id: "web-6",
      title: "Relational database schema modeling in PostgreSQL with Drizzle/Prisma ORM, foreign keys, and indexes",
      categoryId: "db",
      categoryName: "Databases & Data Modeling",
      status: "pending",
      weight: "Database Architecture",
      resource: {
        title: "PostgreSQL Tutorial for Beginners",
        type: "youtube",
        creator: "freeCodeCamp",
        url: "https://www.youtube.com/results?search_query=freecodecamp+postgresql+database+tutorial",
        badge: "Database ↗",
      },
    },
    {
      id: "web-7",
      title: "Setup Redis for distributed caching, session storage, and rate-limiting high-traffic endpoints",
      categoryId: "db",
      categoryName: "Databases & Data Modeling",
      status: "pending",
      weight: "Performance",
      resource: {
        title: "Redis Crash Course & Caching Strategies",
        type: "youtube",
        creator: "Fireship",
        url: "https://www.youtube.com/results?search_query=fireship+redis+crash+course",
        badge: "Visual ↗",
      },
    },
    {
      id: "web-8",
      title: "Dockerize your full-stack application with multi-stage builds and Docker Compose for local environments",
      categoryId: "devops",
      categoryName: "DevOps, Cloud & Production",
      status: "pending",
      weight: "DevOps Core",
      resource: {
        title: "Docker Crash Course for Full Stack Developers",
        type: "youtube",
        creator: "TechWorld with Nana",
        url: "https://www.youtube.com/results?search_query=techworld+with+nana+docker+crash+course",
        badge: "DevOps ↗",
      },
    },
    {
      id: "web-9",
      title: "Configure automated CI/CD pipeline using GitHub Actions (Lint, Typecheck, Unit Tests, and Auto Deploy)",
      categoryId: "devops",
      categoryName: "DevOps, Cloud & Production",
      status: "pending",
      weight: "Automation",
      resource: {
        title: "GitHub Actions CI/CD Complete Course",
        type: "youtube",
        creator: "Kunal Kushwaha",
        url: "https://www.youtube.com/results?search_query=github+actions+ci+cd+kunal+kushwaha",
        badge: "CI/CD ↗",
      },
    },
    {
      id: "web-10",
      title: "Deploy production web application on AWS / Vercel with custom domain, SSL, Sentry monitoring, and logs",
      categoryId: "devops",
      categoryName: "DevOps, Cloud & Production",
      status: "pending",
      weight: "Production Live",
      resource: {
        title: "Deploying Full Stack Apps to Production",
        type: "youtube",
        creator: "Traversy Media",
        url: "https://www.youtube.com/results?search_query=traversy+media+deploy+full+stack+production",
        badge: "Capstone ↗",
      },
    },
  ];

  return {
    id: "fullstack-mastery",
    goal: "Full Stack Web Development",
    topic: "Full Stack Software Engineering",
    timeline: "4–6 Months (200+ Hours)",
    summary:
      "A modern, production-grade roadmap for full stack software engineers. Covers TypeScript, React 19/Next.js, Node.js RESTful APIs, PostgreSQL relational modeling, Docker containerization, and automated CI/CD deployment.",
    phases: [
      {
        id: "p1",
        name: "Phase 1: Modern Frontend & TypeScript Architecture",
        duration: "Weeks 1–5",
        focus: "TypeScript mastery, React 19 Server Components, Tailwind CSS, and state management",
        color: "#38bdf8",
        categoryIds: ["fe"],
      },
      {
        id: "p2",
        name: "Phase 2: Backend APIs, Auth & Microservices",
        duration: "Weeks 6–10",
        focus: "Node.js, Express, RESTful APIs, OAuth/JWT auth, and input validation",
        color: "#10b981",
        categoryIds: ["be"],
      },
      {
        id: "p3",
        name: "Phase 3: Relational Databases & Caching",
        duration: "Weeks 11–16",
        focus: "PostgreSQL, Prisma/Drizzle ORM, schema indexing, ACID transactions, and Redis",
        color: "#a855f7",
        categoryIds: ["db"],
      },
      {
        id: "p4",
        name: "Phase 4: Docker, CI/CD & Cloud Deployment",
        duration: "Weeks 17–22",
        focus: "Docker multi-stage builds, GitHub Actions CI/CD pipelines, and cloud monitoring",
        color: "#f59e0b",
        categoryIds: ["devops"],
      },
    ],
    categories,
    subtasks,
    resources: [
      {
        title: "Full Stack Web Development Course",
        channel: "freeCodeCamp",
        duration: "Complete Course",
        why: "Exhaustive practical guide covering HTML, CSS, JavaScript, React, and Backend systems.",
        url: "https://www.youtube.com/results?search_query=freecodecamp+full+stack+web+development",
      },
      {
        title: "Next.js 15 & React 19 Masterclass",
        channel: "Jack Herrington",
        duration: "Architecture Series",
        why: "Cutting-edge architectural deep dives into Server Components, Server Actions, and client caching.",
        url: "https://www.youtube.com/results?search_query=jack+herrington+nextjs+15",
      },
      {
        title: "Docker & Kubernetes Full Course",
        channel: "TechWorld with Nana",
        duration: "DevOps Playlist",
        why: "The gold standard visual breakdown of containers, orchestration, and continuous integration.",
        url: "https://www.youtube.com/results?search_query=techworld+with+nana+docker+kubernetes",
      },
    ],
  };
}

// ==========================================
// UNIVERSAL HEURISTIC BREAKDOWN GENERATOR
// ==========================================

function generateUniversalHeuristicBreakdown(rawTopic: string): GoalBreakdown {
  const topic = extractGoalTopic(rawTopic);
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const categories: SubtaskCategory[] = [
    {
      id: "foundations",
      name: `${topic} Foundations & Theory`,
      shortName: "Foundations",
      icon: "📘",
      description: `Core principles, foundational concepts, syntax, and theoretical framework of ${topic}`,
      color: "#6366f1",
    },
    {
      id: "practice",
      name: "Applied Mechanics & Hands-On Exercises",
      shortName: "Application",
      icon: "⚡",
      description: "Direct practice, problem-solving techniques, standard workflows, and implementation drills",
      color: "#38bdf8",
    },
    {
      id: "projects",
      name: "Real-World Projects & Case Studies",
      shortName: "Projects",
      icon: "🛠️",
      description: "Building production-grade artifacts, end-to-end deliverables, and portfolio proof-of-work",
      color: "#10b981",
    },
    {
      id: "mastery",
      name: "Advanced Optimization & Diagnostic Evaluation",
      shortName: "Mastery",
      icon: "🏆",
      description: "Performance tuning, edge cases, timed simulated assessments, and diagnostic self-testing",
      color: "#f59e0b",
    },
  ];

  const subtasks: CuratedSubtask[] = [
    // Foundations
    {
      id: `${slug}-1`,
      title: `Map official blueprint, high-yield syllabus, and prerequisite knowledge base for ${topic}`,
      categoryId: "foundations",
      categoryName: `${topic} Foundations & Theory`,
      status: "pending",
      weight: "Essential Blueprint",
      resource: {
        title: `${topic} Complete Beginner Course & Roadmap`,
        type: "youtube",
        creator: "freeCodeCamp / MIT OCW",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " complete roadmap course")}`,
        badge: "Course ↗",
      },
    },
    {
      id: `${slug}-2`,
      title: `Study foundational terminology, standard conventions, and core mechanics of ${topic}`,
      categoryId: "foundations",
      categoryName: `${topic} Foundations & Theory`,
      status: "pending",
      weight: "Core Concepts",
      resource: {
        title: `${topic} Concepts Explained Step-by-Step`,
        type: "youtube",
        creator: "CrashCourse / Edureka",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " concepts explained")}`,
        badge: "Visual ↗",
      },
    },
    {
      id: `${slug}-3`,
      title: `Setup professional development environment, toolchain, and essential libraries/resources for ${topic}`,
      categoryId: "foundations",
      categoryName: `${topic} Foundations & Theory`,
      status: "pending",
      weight: "Tooling Setup",
      resource: {
        title: `Best Setup and Tools for ${topic}`,
        type: "youtube",
        creator: "Traversy Media / Fireship",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " setup tutorial")}`,
        badge: "Setup ↗",
      },
    },
    {
      id: `${slug}-4`,
      title: `Conduct initial diagnostic baseline assessment to identify knowledge gaps and strengths in ${topic}`,
      categoryId: "foundations",
      categoryName: `${topic} Foundations & Theory`,
      status: "pending",
      weight: "Baseline Check",
      resource: {
        title: `${topic} Diagnostic Self-Assessment Quiz & Solutions`,
        type: "youtube",
        creator: "Khan Academy / YouTube Learning",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " diagnostic test questions")}`,
        badge: "Quiz ↗",
      },
    },

    // Applied Mechanics
    {
      id: `${slug}-5`,
      title: `Complete 10 hands-on guided exercises focusing on high-frequency patterns in ${topic}`,
      categoryId: "practice",
      categoryName: "Applied Mechanics & Hands-On Exercises",
      status: "pending",
      weight: "Pattern Mastery",
      resource: {
        title: `${topic} Practice Exercises & Problem Solving`,
        type: "youtube",
        creator: "Top Industry Instructors",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " practice exercises")}`,
        badge: "Practice ↗",
      },
    },
    {
      id: `${slug}-6`,
      title: `Analyze standard solutions and learn optimal heuristics to avoid common anti-patterns in ${topic}`,
      categoryId: "practice",
      categoryName: "Applied Mechanics & Hands-On Exercises",
      status: "pending",
      weight: "Best Practices",
      resource: {
        title: `Common Mistakes to Avoid in ${topic}`,
        type: "youtube",
        creator: "Senior Practitioners",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " common mistakes and best practices")}`,
        badge: "Insights ↗",
      },
    },
    {
      id: `${slug}-7`,
      title: `Deconstruct 3 industry case studies or historical benchmark solutions in ${topic}`,
      categoryId: "practice",
      categoryName: "Applied Mechanics & Hands-On Exercises",
      status: "pending",
      weight: "Case Studies",
      resource: {
        title: `${topic} Case Studies & Real-World Walkthroughs`,
        type: "youtube",
        creator: "Harvard CS50 / Stanford",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " case study analysis")}`,
        badge: "Deep-Dive ↗",
      },
    },
    {
      id: `${slug}-8`,
      title: `Complete timed practice drill under realistic constraints to build speed and accuracy`,
      categoryId: "practice",
      categoryName: "Applied Mechanics & Hands-On Exercises",
      status: "pending",
      weight: "Speed & Fluency",
      resource: {
        title: `${topic} Speed Drill & Timed Walkthrough`,
        type: "youtube",
        creator: "Specialized Coaches",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " timed practice session")}`,
        badge: "Drill ↗",
      },
    },

    // Real-World Projects
    {
      id: `${slug}-9`,
      title: `Design and architect first end-to-end capstone project applying all core principles of ${topic}`,
      categoryId: "projects",
      categoryName: "Real-World Projects & Case Studies",
      status: "pending",
      weight: "Capstone Project 1",
      resource: {
        title: `Build a Full Project from Scratch with ${topic}`,
        type: "youtube",
        creator: "freeCodeCamp",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent("build project from scratch " + topic)}`,
        badge: "Project ↗",
      },
    },
    {
      id: `${slug}-10`,
      title: `Implement robust error handling, automated tests, and validation checks for the project`,
      categoryId: "projects",
      categoryName: "Real-World Projects & Case Studies",
      status: "pending",
      weight: "Robustness",
      resource: {
        title: `Testing & Quality Assurance in ${topic}`,
        type: "youtube",
        creator: "Professional Engineers",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " testing and debugging")}`,
        badge: "Quality ↗",
      },
    },
    {
      id: `${slug}-11`,
      title: `Document technical architecture, decision logs, and publish deliverable to public portfolio / GitHub`,
      categoryId: "projects",
      categoryName: "Real-World Projects & Case Studies",
      status: "pending",
      weight: "Proof of Work",
      resource: {
        title: `How to Document and Showcase Projects in ${topic}`,
        type: "youtube",
        creator: "Tech Career Mentors",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " portfolio project showcase")}`,
        badge: "Portfolio ↗",
      },
    },
    {
      id: `${slug}-12`,
      title: `Solicit peer critique and perform code review / design audit to iterate on quality`,
      categoryId: "projects",
      categoryName: "Real-World Projects & Case Studies",
      status: "pending",
      weight: "Iterative Polish",
      resource: {
        title: `${topic} Project Review & Critique Sessions`,
        type: "youtube",
        creator: "Industry Leaders",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " project review feedback")}`,
        badge: "Review ↗",
      },
    },

    // Advanced Mastery
    {
      id: `${slug}-13`,
      title: `Deep-dive into advanced edge cases, optimization bottlenecks, and performance profiling in ${topic}`,
      categoryId: "mastery",
      categoryName: "Advanced Optimization & Diagnostic Evaluation",
      status: "pending",
      weight: "Advanced Edge Cases",
      resource: {
        title: `Advanced ${topic} Masterclass & Optimization`,
        type: "youtube",
        creator: "Domain Experts",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent("advanced " + topic + " masterclass")}`,
        badge: "Advanced ↗",
      },
    },
    {
      id: `${slug}-14`,
      title: `Study recent research, evolving standards, and future paradigms impacting ${topic}`,
      categoryId: "mastery",
      categoryName: "Advanced Optimization & Diagnostic Evaluation",
      status: "pending",
      weight: "Cutting Edge",
      resource: {
        title: `The Future of ${topic} & Emerging Trends`,
        type: "youtube",
        creator: "Conference Talks & Keynotes",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " conference keynote talk")}`,
        badge: "Keynote ↗",
      },
    },
    {
      id: `${slug}-15`,
      title: `Attempt 2 full-length simulated examinations or technical assessments under exam conditions`,
      categoryId: "mastery",
      categoryName: "Advanced Optimization & Diagnostic Evaluation",
      status: "pending",
      weight: "Mock Assessment",
      resource: {
        title: `${topic} Full Mock Assessment & Solutions Walkthrough`,
        type: "youtube",
        creator: "Certification & Test Prep",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " mock test assessment walkthrough")}`,
        badge: "Full Mock ↗",
      },
    },
    {
      id: `${slug}-16`,
      title: `Synthesize comprehensive personal cheatsheet and knowledge graph for rapid long-term recall`,
      categoryId: "mastery",
      categoryName: "Advanced Optimization & Diagnostic Evaluation",
      status: "pending",
      weight: "Retention Cheatsheet",
      resource: {
        title: `${topic} Complete Revision Cheat Sheet & Summary`,
        type: "youtube",
        creator: "YouTube Learning / freeCodeCamp",
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " cheat sheet revision summary")}`,
        badge: "Cheatsheet ↗",
      },
    },
  ];

  const phases: GoalMilestonePhase[] = [
    {
      id: "p1",
      name: "Phase 1: Foundations & Architecture Blueprint",
      duration: "Weeks 1–4",
      focus: `Master foundational principles, core terminology, environment setup, and baseline diagnostics for ${topic}`,
      color: "#6366f1",
      categoryIds: ["foundations"],
    },
    {
      id: "p2",
      name: "Phase 2: Applied Mechanics & Hands-On Drills",
      duration: "Weeks 5–8",
      focus: "Hands-on exercises, standard solution patterns, speed drills, and anti-pattern avoidance",
      color: "#38bdf8",
      categoryIds: ["practice"],
    },
    {
      id: "p3",
      name: "Phase 3: Real-World Projects & Capstones",
      duration: "Weeks 9–14",
      focus: "End-to-end capstone building, testing, documentation, and portfolio proof-of-work",
      color: "#10b981",
      categoryIds: ["projects"],
    },
    {
      id: "p4",
      name: "Phase 4: Advanced Mastery & Diagnostic Sprint",
      duration: "Weeks 15–18",
      focus: "Performance profiling, full simulated mock assessments, and rapid-recall knowledge synthesis",
      color: "#f59e0b",
      categoryIds: ["mastery"],
    },
  ];

  const resources: GoalResource[] = [
    {
      title: `${topic} Complete Comprehensive Guide`,
      channel: "freeCodeCamp",
      duration: "Full Video Course",
      why: "In-depth, zero-to-hero curriculum with practical examples and community code repositories.",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent("freecodecamp " + topic)}`,
    },
    {
      title: `${topic} Fundamentals & Visual Explanations`,
      channel: "MIT OpenCourseWare / Harvard",
      duration: "University Lectures",
      why: "Rigorous theoretical grounding and foundational mental models taught by world-class professors.",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent("mit opencourseware " + topic)}`,
    },
    {
      title: `${topic} Hands-On Exercises & Best Practices`,
      channel: "YouTube Learning",
      duration: "Curated Playlist",
      why: "Practical, project-based exercises for building muscle memory and solving real-world challenges.",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(topic + " practical exercises tutorial")}`,
    },
    {
      title: `${topic} Advanced Concepts & Mock Assessments`,
      channel: "Industry Practitioners",
      duration: "Masterclass Series",
      why: "Edge cases, performance optimizations, and diagnostic self-testing for high mastery.",
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent("advanced " + topic + " masterclass")}`,
    },
  ];

  return {
    id: slug,
    goal: `${topic} Mastery`,
    topic,
    timeline: "4–6 Months (150+ Study Hours)",
    summary: `A researched milestone roadmap and subtasks curriculum for **${topic}**. Decomposed into 4 progressive phases, 16 actionable subtasks with specific weights, and curated high-yield video tutorials on YouTube.`,
    phases,
    categories,
    subtasks,
    resources,
  };
}

// ==========================================
// AI-POWERED DYNAMIC GENERATOR (OpenRouter / Gemini)
// ==========================================

async function generateWithAI(cleanTopic: string): Promise<GoalBreakdown | null> {
  const openRouterKey = process.env.OPENROUTER_API_KEY || "";
  if (!openRouterKey || openRouterKey.length < 10) return null;

  const prompt = `You are Orbit AI's Master Curriculum Architect.
Generate a structured, expert-level learning curriculum and milestone roadmap for this long-term goal: "${cleanTopic}".

Return ONLY valid JSON matching this exact structure:
{
  "goal": "${cleanTopic} Mastery",
  "timeline": "e.g. 4-6 Months (180 Hours)",
  "summary": "2-3 sentences explaining the strategic sequencing, high-yield topics, and why this path guarantees mastery.",
  "phases": [
    {
      "id": "p1",
      "name": "Phase 1: Title",
      "duration": "Weeks 1-4",
      "focus": "Clear summary of focus",
      "color": "#6366f1",
      "categoryIds": ["c1"]
    },
    {
      "id": "p2",
      "name": "Phase 2: Title",
      "duration": "Weeks 5-8",
      "focus": "Clear summary of focus",
      "color": "#38bdf8",
      "categoryIds": ["c2"]
    },
    {
      "id": "p3",
      "name": "Phase 3: Title",
      "duration": "Weeks 9-14",
      "focus": "Clear summary of focus",
      "color": "#10b981",
      "categoryIds": ["c3"]
    },
    {
      "id": "p4",
      "name": "Phase 4: Title",
      "duration": "Weeks 15-20",
      "focus": "Clear summary of focus",
      "color": "#f59e0b",
      "categoryIds": ["c4"]
    }
  ],
  "categories": [
    {
      "id": "c1",
      "name": "Category 1 Name",
      "shortName": "Short 1",
      "icon": "⚡",
      "description": "Scope of this subject area",
      "color": "#6366f1"
    },
    {
      "id": "c2",
      "name": "Category 2 Name",
      "shortName": "Short 2",
      "icon": "🚀",
      "description": "Scope of this subject area",
      "color": "#38bdf8"
    },
    {
      "id": "c3",
      "name": "Category 3 Name",
      "shortName": "Short 3",
      "icon": "🧠",
      "description": "Scope of this subject area",
      "color": "#10b981"
    },
    {
      "id": "c4",
      "name": "Category 4 Name",
      "shortName": "Short 4",
      "icon": "🏆",
      "description": "Scope of this subject area",
      "color": "#f59e0b"
    }
  ],
  "subtasks": [
    {
      "id": "t1",
      "title": "Specific, actionable task description",
      "categoryId": "c1",
      "categoryName": "Category 1 Name",
      "status": "pending",
      "weight": "Core Foundation",
      "resource": {
        "title": "Recommended lecture or video title",
        "type": "youtube",
        "creator": "Real YouTube channel or instructor name",
        "url": "https://www.youtube.com/results?search_query=...",
        "badge": "Lecture ↗"
      }
    }
  ],
  "resources": [
    {
      "title": "Top Course Title",
      "channel": "Channel Name",
      "duration": "Full Course",
      "why": "Why this resource is essential",
      "url": "https://www.youtube.com/results?search_query=..."
    }
  ]
}

Provide at least 16 granular subtasks (4 per category) with real YouTube creator channels (like freeCodeCamp, MIT OCW, StatQuest, etc.) and valid YouTube search URLs.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 3500,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const rawContent = json?.choices?.[0]?.message?.content;
    if (!rawContent) return null;

    const parsed = JSON.parse(rawContent);
    if (!parsed.goal || !Array.isArray(parsed.phases) || !Array.isArray(parsed.subtasks) || parsed.subtasks.length < 8) {
      return null;
    }

    const slug = cleanTopic.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      id: slug,
      goal: parsed.goal,
      topic: cleanTopic,
      timeline: parsed.timeline || "4–6 Months",
      summary: parsed.summary || `Expert-engineered learning path for ${cleanTopic}.`,
      phases: parsed.phases,
      categories: parsed.categories || [],
      subtasks: parsed.subtasks.map((st: any, i: number) => ({
        id: st.id || `st-${i + 1}`,
        title: st.title,
        categoryId: st.categoryId || "c1",
        categoryName: st.categoryName || "Core",
        status: "pending",
        weight: st.weight || "High Yield",
        resource: {
          title: st.resource?.title || `${cleanTopic} Tutorial`,
          type: "youtube",
          creator: st.resource?.creator || "YouTube Learning",
          url: st.resource?.url || `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanTopic + " " + st.title)}`,
          badge: st.resource?.badge || "Watch ↗",
        },
      })),
      resources: parsed.resources || [],
    };
  } catch {
    return null;
  }
}

// ==========================================
// MAIN EXPORTED ENGINE ENTRYPOINT
// ==========================================

export async function generateGoalBreakdown(userPromptOrTopic: string): Promise<GoalBreakdown> {
  const clean = userPromptOrTopic.trim();
  const lower = clean.toLowerCase();

  // 1. Check Presets
  if (/gate|engineering\s+exam|graduate\s+aptitude/i.test(lower)) {
    return getGateCurriculum();
  }
  if (/billionaire|startup|wealth|venture|founder|saas|make\s+money/i.test(lower)) {
    return getBillionaireCurriculum();
  }
  if (/dsa|data\s+structures|leetcode|algorithm|coding\s+interview/i.test(lower)) {
    return getDsaCurriculum();
  }
  if (/full\s*stack|web\s*dev|frontend|backend|next\.?js|react\s+developer/i.test(lower)) {
    return getWebDevCurriculum();
  }

  // 2. Try AI Generation for custom goals
  const cleanTopic = extractGoalTopic(clean);
  try {
    const aiResult = await generateWithAI(cleanTopic);
    if (aiResult) return aiResult;
  } catch {}

  // 3. Fallback to rich universal heuristic generator
  return generateUniversalHeuristicBreakdown(cleanTopic);
}
