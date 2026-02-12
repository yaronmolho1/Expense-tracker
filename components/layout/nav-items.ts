export interface NavItem {
  label: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/" },
      { label: "Upload", href: "/upload" },
      { label: "Transactions", href: "/transactions" },
      { label: "Time Flow", href: "/time-flow" },
      { label: "Reports", href: "/reports" },
    ],
  },
  {
    title: "Manage",
    items: [
      { label: "Businesses", href: "/manage/businesses" },
      { label: "Cards", href: "/manage/cards" },
      { label: "Subscriptions", href: "/manage/subscriptions" },
      { label: "Categories", href: "/manage/categories" },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Database", href: "/admin/database" },
    ],
  },
];
