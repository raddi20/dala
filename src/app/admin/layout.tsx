import { AdminNav } from "@/components/admin-nav";
import { protectedOrdersOn } from "@/lib/protected-order";

/** Shared admin nav. Each page still calls requireAdmin itself. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminNav ordersOn={protectedOrdersOn()} />
      {children}
    </>
  );
}
