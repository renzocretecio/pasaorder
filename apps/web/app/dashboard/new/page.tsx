import type { Metadata } from "next";
import { StoreForm } from "@/features/catalog/forms";
import { EditorPanel } from "@/features/catalog/workspace";
export const metadata: Metadata = { title: "Set up your store | PasaOrder" };
export default async function NewStore() {
  return (
    <EditorPanel
      title="Let’s set up your store."
      description="Start with the basics. Your catalog stays private until you’re ready to publish."
      back="/dashboard"
    >
      <StoreForm />
    </EditorPanel>
  );
}
