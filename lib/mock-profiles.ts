import type { DateKey, IsoTimestamp } from "@/types/common";
import type { Employee } from "@/types/employee";
import type { Address, EducationEntry, EmployeeProfile, ExperienceEntry } from "@/types/profile";
import { emptyProfileContent } from "@/lib/profile-utils";

/**
 * Hand-written profiles for the seeded team. Most are complete so the admin
 * view has something to show. Two are deliberately not: EMP-1009 has not
 * started and EMP-1011 saved a draft, which is what a new hire looks like.
 */

interface SeedProfile {
  dob: DateKey;
  gender: string;
  marital: string;
  blood: string;
  address: Address;
  education: Omit<EducationEntry, "id">[];
  /** Empty means a fresher. */
  experience: Omit<ExperienceEntry, "id">[];
  skills: string[];
  summary: string;
  emergency: { name: string; relationship: string; phone: string };
  bank: string;
}

const job = (company: string, designation: string, from: DateKey, to: DateKey | "", responsibilities: string) => ({
  company,
  designation,
  from,
  to,
  current: to === "",
  responsibilities,
});

const SEEDS: Record<string, SeedProfile> = {
  "EMP-1001": {
    dob: "2001-08-14",
    gender: "male",
    marital: "single",
    blood: "B+",
    address: { line1: "Flat 402, Lakeview Residency, Baner Road", city: "Pune", state: "Maharashtra", pincode: "411045" },
    education: [
      { degree: "Bachelor's degree", fieldOfStudy: "Computer Engineering", institution: "College of Engineering Pune", yearOfPassing: "2024" },
      { degree: "12th / Higher Secondary", fieldOfStudy: "Science (PCM)", institution: "Fergusson College", yearOfPassing: "2020" },
    ],
    experience: [job("Brightpath Labs", "Software Intern", "2023-12-01", "2024-05-31", "Built internal dashboards in React and wrote API tests.")],
    skills: ["TypeScript", "React", "Node.js", "SQL"],
    summary: "Early-career engineer who enjoys turning rough ideas into clean, tested features.",
    emergency: { name: "Sunita Sharma", relationship: "parent", phone: "+91 98220 41001" },
    bank: "HDFC Bank",
  },
  "EMP-1002": {
    dob: "1992-02-27",
    gender: "female",
    marital: "married",
    blood: "O+",
    address: { line1: "12, Periyar Nagar, Kakkanad", city: "Kochi", state: "Kerala", pincode: "682030" },
    education: [{ degree: "Master's degree", fieldOfStudy: "Computer Applications", institution: "Cochin University of Science and Technology", yearOfPassing: "2015" }],
    experience: [
      job("Finlytics", "Software Engineer", "2015-07-01", "2018-09-30", "Payments reconciliation services in Java."),
      job("Orbit Systems", "Senior Software Engineer", "2018-10-15", "2022-02-28", "Led a team of four on a logistics platform."),
    ],
    skills: ["Java", "Spring Boot", "AWS", "System design", "Mentoring"],
    summary: "Backend engineer with a focus on reliable payment and reporting systems.",
    emergency: { name: "Anil Menon", relationship: "spouse", phone: "+91 98470 52002" },
    bank: "State Bank of India",
  },
  "EMP-1003": {
    dob: "1989-11-05",
    gender: "male",
    marital: "married",
    blood: "A+",
    address: { line1: "B-9, Shanti Vihar, Andheri East", city: "Mumbai", state: "Maharashtra", pincode: "400069" },
    education: [{ degree: "Bachelor's degree", fieldOfStudy: "Commerce", institution: "Mumbai University", yearOfPassing: "2010" }],
    experience: [
      job("Zenith Retail", "Sales Executive", "2010-08-01", "2015-03-31", "Managed 40 channel-partner accounts."),
      job("PrimeCo Distribution", "Area Sales Manager", "2015-04-15", "2021-08-20", "Grew regional revenue 3x over six years."),
    ],
    skills: ["Account management", "Negotiation", "CRM", "Forecasting"],
    summary: "Sales leader who builds long relationships with distribution partners.",
    emergency: { name: "Pooja Mehta", relationship: "spouse", phone: "+91 98920 63003" },
    bank: "ICICI Bank",
  },
  "EMP-1004": {
    dob: "1995-05-19",
    gender: "female",
    marital: "single",
    blood: "AB+",
    address: { line1: "27, Besant Avenue, Adyar", city: "Chennai", state: "Tamil Nadu", pincode: "600020" },
    education: [{ degree: "Bachelor's degree", fieldOfStudy: "Design", institution: "National Institute of Design", yearOfPassing: "2017" }],
    experience: [job("Pixelcraft Studio", "UI Designer", "2017-07-01", "2022-12-31", "Mobile app interfaces and design systems for fintech clients.")],
    skills: ["Figma", "Design systems", "User research", "Prototyping"],
    summary: "Product designer who likes clear flows and well-documented components.",
    emergency: { name: "Lakshmi Iyer", relationship: "parent", phone: "+91 98410 74004" },
    bank: "Axis Bank",
  },
  "EMP-1005": {
    dob: "1996-09-30",
    gender: "male",
    marital: "single",
    blood: "O-",
    address: { line1: "5/21, Civil Lines", city: "Jaipur", state: "Rajasthan", pincode: "302006" },
    education: [{ degree: "Bachelor's degree", fieldOfStudy: "Business Administration", institution: "University of Rajasthan", yearOfPassing: "2018" }],
    experience: [job("SwiftMove Logistics", "Dispatch Coordinator", "2018-08-01", "2023-06-15", "Planned daily routes for a 30-vehicle fleet.")],
    skills: ["Logistics planning", "Excel", "Vendor management"],
    summary: "Operations professional focused on on-time delivery and tidy processes.",
    emergency: { name: "Rekha Singh", relationship: "parent", phone: "+91 94140 85005" },
    bank: "Punjab National Bank",
  },
  "EMP-1006": {
    dob: "1994-01-12",
    gender: "female",
    marital: "married",
    blood: "B-",
    address: { line1: "Plot 18, Kothrud", city: "Pune", state: "Maharashtra", pincode: "411038" },
    education: [{ degree: "Master's degree", fieldOfStudy: "Human Resource Management", institution: "Symbiosis Institute of Business Management", yearOfPassing: "2017" }],
    experience: [job("Talentbridge", "HR Associate", "2017-06-01", "2022-10-31", "Onboarding, payroll inputs and policy documentation.")],
    skills: ["Onboarding", "Employee relations", "HRIS", "Recruitment"],
    summary: "HR generalist who cares about a smooth first month for every new joiner.",
    emergency: { name: "Nikhil Kulkarni", relationship: "spouse", phone: "+91 98230 96006" },
    bank: "Bank of Maharashtra",
  },
  "EMP-1007": {
    dob: "1997-03-08",
    gender: "male",
    marital: "single",
    blood: "A-",
    address: { line1: "H.No 8-2-120, Banjara Hills", city: "Hyderabad", state: "Telangana", pincode: "500034" },
    education: [{ degree: "Bachelor's degree", fieldOfStudy: "Commerce", institution: "Osmania University", yearOfPassing: "2019" }],
    experience: [job("Kalyan & Associates", "Audit Assistant", "2019-07-01", "2024-01-20", "Statutory audit support and GST reconciliations.")],
    skills: ["Tally", "GST", "Reconciliation", "Excel"],
    summary: "Accounts analyst with a background in audit and indirect tax.",
    emergency: { name: "Suresh Reddy", relationship: "parent", phone: "+91 98480 17007" },
    bank: "Canara Bank",
  },
  "EMP-1008": {
    dob: "1993-12-21",
    gender: "female",
    marital: "married",
    blood: "O+",
    address: { line1: "A-14, Model Town", city: "Delhi", state: "Delhi", pincode: "110009" },
    education: [{ degree: "Master's degree", fieldOfStudy: "Mass Communication", institution: "Jamia Millia Islamia", yearOfPassing: "2016" }],
    experience: [
      job("BrandBuzz", "Content Executive", "2016-08-01", "2020-04-30", "Social calendars and long-form content."),
      job("Growthly", "Marketing Specialist", "2020-05-15", "2023-10-01", "Campaign planning across email and paid social."),
    ],
    skills: ["Content strategy", "SEO", "Email marketing", "Analytics"],
    summary: "Marketer who pairs good writing with measurable campaigns.",
    emergency: { name: "Rohit Joshi", relationship: "spouse", phone: "+91 98110 28008" },
    bank: "Kotak Mahindra Bank",
  },
  "EMP-1010": {
    dob: "1994-07-02",
    gender: "female",
    marital: "single",
    blood: "B+",
    address: { line1: "22, Ring Road, Indira Nagar", city: "Lucknow", state: "Uttar Pradesh", pincode: "226016" },
    education: [{ degree: "Bachelor's degree", fieldOfStudy: "Information Technology", institution: "AKTU", yearOfPassing: "2016" }],
    experience: [job("Testwise", "QA Analyst", "2016-08-01", "2023-05-10", "Manual and automated regression testing.")],
    skills: ["Test automation", "Selenium", "API testing"],
    summary: "QA engineer who writes tests that are easy to read.",
    emergency: { name: "Imran Khan", relationship: "sibling", phone: "+91 98390 39010" },
    bank: "Union Bank of India",
  },
};

function accountNumberFor(id: string): string {
  const n = Number(id.replace(/\D/g, ""));
  return String(5_000_000_000 + n * 7_919);
}

function entryIds<T>(id: string, prefix: string, rows: T[]): (T & { id: string })[] {
  return rows.map((row, i) => ({ ...row, id: `${prefix}-${id}-${i + 1}` }));
}

export function withSeedProfiles(employees: Employee[], seededAt: IsoTimestamp): Employee[] {
  return employees.map((employee) => {
    const seed = SEEDS[employee.id];

    // A saved draft: the first two sections are done, the rest is still empty.
    if (employee.id === "EMP-1011") {
      const draft = emptyProfileContent();
      const profile: EmployeeProfile = {
        ...draft,
        state: "draft",
        updatedAt: seededAt,
        personal: {
          ...draft.personal,
          dateOfBirth: "1998-04-16",
          gender: "male",
          maritalStatus: "single",
          currentAddress: { line1: "31, Sector 21, Dwarka", city: "Delhi", state: "Delhi", pincode: "110075" },
        },
        education: entryIds("EMP-1011", "edu", [
          { degree: "Bachelor's degree", fieldOfStudy: "Business Studies", institution: "Delhi University", yearOfPassing: "2020" },
        ]),
      };
      return { ...employee, profile };
    }
    if (!seed) return employee;

    const base = emptyProfileContent();
    const profile: EmployeeProfile = {
      state: "submitted",
      updatedAt: seededAt,
      submittedAt: seededAt,
      personal: {
        ...base.personal,
        dateOfBirth: seed.dob,
        gender: seed.gender,
        maritalStatus: seed.marital,
        bloodGroup: seed.blood,
        personalEmail: `${employee.fullName.toLowerCase().replace(/[^a-z]+/g, ".")}@mailbox.example`,
        currentAddress: seed.address,
        permanentSameAsCurrent: true,
      },
      education: entryIds(employee.id, "edu", seed.education),
      experience: {
        isFresher: seed.experience.length === 0,
        entries: entryIds(employee.id, "exp", seed.experience),
        skills: seed.skills,
        summary: seed.summary,
      },
      emergency: seed.emergency,
      bank: {
        accountHolder: employee.fullName,
        bankName: seed.bank,
        accountNumber: accountNumberFor(employee.id),
        ifsc: `${seed.bank.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase().padEnd(4, "X")}0001234`,
        pan: "",
        uan: "",
      },
    };
    return { ...employee, profile };
  });
}
