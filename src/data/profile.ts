export interface LocationContact {
  label: string;
  href: string;
  icon: "schedule" | "phone" | "web" | "map";
  external?: boolean;
}

export interface PracticeLocation {
  name: string;
  address: string;
  phone: string;
  items: LocationContact[];
}

export interface HelpfulLink {
  title: string;
  subTitle?: string;
  href: string;
}

export interface Publication {
  citation: string;
  authorsAndJournal: string;
  year: string;
}

export const SITE_METADATA = {
  title: "Karen Kirpaul (Guyton), DPM | Kettering & Beavercreek, Ohio Podiatrist",
  description:
    "Podiatrist in Kettering and Beavercreek, Ohio. Plantar fasciitis, foot and ankle surgery, diabetic foot care, and comprehensive podiatric medicine.",
  ogImage: "/logo-hi-res-color.png",
  locale: "en_US",
} as const;

export const DOCTOR_PROFILE = {
  fullName: "Karen Kirpaul (Guyton)",
  credentials: "DPM",
  shortName: "Karen Kirpaul, DPM",
  title: "Doctor of Podiatric Medicine",
  tagline: "Expert Foot and Ankle Care",
  serviceArea: "Kettering & Beavercreek, OH",
  badges: ["APMA Member", "ABPM Diplomate"],
  linkedInUrl: "https://www.linkedin.com/in/karen-e-kirpaul-dpm-6831bb102/",
  bioParagraphs: [
    "Proudly serving patients in Kettering, Beavercreek, and surrounding Ohio communities, Dr. Karen E. Kirpaul (Guyton), DPM received her doctorate in podiatric medicine from Kent State University where she received awards for her academic performance. She then went on to complete a three-year hospital-based interdisciplinary residency in foot and ankle surgery at the Salem Veterans Affairs Medical Center in Salem, VA.",
    "During her residency training, her experiences helped to shape a holistic approach to patient care. While in residency, Dr. Kirpaul assisted in various research projects and publications including antibiotic selection in diabetic foot infections, tumors of the foot and ankle, biomechanics, and onychomycosis.",
    "She has also earned her B.S. in Biological Sciences from Wright State University located in her hometown Dayton, OH.",
    "Outside of work, Dr. Kirpaul enjoys dog sports, cooking with her husband, and spending time with her 3 children.",
    "Dr. Kirpaul is a member of the American Podiatric Medical Association (APMA) and is a diplomate of the American Board of Podiatric Medicine (ABPM).",
  ],
} as const;

export interface ClinicalService {
  title: string;
  description: string;
  icon: "activity" | "stethoscope" | "shield" | "sparkles";
}

export interface CredentialItem {
  title: string;
  institution: string;
  detail: string;
}

export const APPOINTMENT_URL =
  "https://www.feetfirstinstitute.com/schedule?utm_medium=markup";

export const CLINICAL_SERVICES: ClinicalService[] = [
  {
    title: "Heel Pain & Plantar Fasciitis",
    description:
      "Targeted biomechanical evaluation and evidence-based relief for chronic heel, arch, and tendon pain.",
    icon: "activity",
  },
  {
    title: "Foot & Ankle Surgery",
    description:
      "Hospital-trained surgical care informed by a three-year interdisciplinary residency at Salem VA Medical Center.",
    icon: "stethoscope",
  },
  {
    title: "Diabetic Foot Care",
    description:
      "Preventive screenings, infection management, and holistic care to protect long-term mobility.",
    icon: "shield",
  },
  {
    title: "Nail & Skin Conditions",
    description:
      "Accurate diagnosis and treatment for onychomycosis, skin lesions, and tumors of the foot and ankle.",
    icon: "sparkles",
  },
];

export const CREDENTIALS_TIMELINE: CredentialItem[] = [
  {
    title: "Doctor of Podiatric Medicine (DPM)",
    institution: "Kent State University",
    detail: "Graduated with academic performance awards",
  },
  {
    title: "Foot & Ankle Surgery Residency",
    institution: "Salem Veterans Affairs Medical Center, Salem, VA",
    detail: "Three-year hospital-based interdisciplinary residency",
  },
  {
    title: "B.S. in Biological Sciences",
    institution: "Wright State University, Dayton, OH",
    detail: "Undergraduate studies in her hometown",
  },
  {
    title: "Board Certification & Memberships",
    institution: "ABPM & APMA",
    detail: "Diplomate, American Board of Podiatric Medicine; Member, APMA",
  },
];

export const LOCATIONS: PracticeLocation[] = [
  {
    name: "Feet First Institute of Beavercreek",
    address: "30 W Rahn Rd #12, Dayton, OH 45429",
    phone: "937-705-6100",
    items: [
      {
        label: "Request Appointment",
        href: "https://www.feetfirstinstitute.com/schedule?utm_medium=markup",
        icon: "schedule",
        external: true,
      },
      {
        label: "937-705-6100",
        href: "tel:+19377056100",
        icon: "phone",
        external: false,
      },
      {
        label: "https://www.feetfirstinstitute.com/",
        href: "https://www.feetfirstinstitute.com/?view=booking",
        icon: "web",
        external: true,
      },
      {
        label: "30 W Rahn Rd #12, Dayton, OH 45429",
        href: "https://www.google.com/maps/place/Feet+First+Institute+of+Beavercreek:+Stephan+Giambi,+DPM/@39.746133,-84.056033,1191m/data=!3m1!1e3!4m6!3m5!1s0x88409bdaaa91159f:0xa0e1401477faed39!8m2!3d39.7461331!4d-84.0560326!16s%2Fg%2F11tnwt3_x1?hl=en&entry=ttu&g_ep=EgoyMDI2MDEwNi4wIKXMDSoASAFQAw%3D%3D",
        icon: "map",
        external: true,
      },
    ],
  },
];

export const HELPFUL_LINKS: HelpfulLink[] = [
  {
    title: "APMA",
    subTitle: "Common conditions affecting the foot and ankle",
    href: "https://www.apma.org/patients-and-the-public/conditions-affecting-the-foot-and-ankle/",
  },
  {
    title: "Foothealthfacts.org (ACFAS)",
    subTitle: "Browse foot conditions: alphabetical list",
    href: "https://www.foothealthfacts.org/foot-ankle-conditions/browse-foot-ankle-conditions",
  },
  {
    title: "Footwear and products with the APMA Seal of Acceptance/Approval",
    href: "https://www.apma.org/patients-and-the-public/apma-seal-program-footwear-products/",
  },
  {
    title: "Interested in becoming a podiatrist?",
    href: "https://www.stepintopodiatry.com/",
  },
  {
    title: "Find a board certified podiatrist",
    href: "https://my.podiatryboard.org/pages/find-a-doctor",
  },
];

export const PUBLICATIONS: Publication[] = [
  {
    citation:
      "Commercial Multiplex Polymerase Chain Reaction versus Periodic Acid–Schiff Testing for the Diagnosis of Onychomycosis",
    authorsAndJournal: "B Caldwell et al, Journal of the APMA (JAPMA), Nov/Dec 2020, Vol 110, No 6.",
    year: "2020",
  },
  {
    citation: "Biomechanical Findings in Patients with Bipartite Medial Cuneiforms",
    authorsAndJournal:
      "A Lee et al, World Academy of Science, Engineering and Technology, International Journal of Sport and Health Sciences, Vol:16, No:3, 2022.",
    year: "2022",
  },
];
