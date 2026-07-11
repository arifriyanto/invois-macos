import { LanguageProvider } from "@/lib/i18n";
import { InvoiceProvider } from "@/lib/store";
import { CustomersProvider } from "@/lib/customers-store";
import { InvoicesProvider } from "@/lib/invoices-store";
import { CatalogProvider } from "@/lib/catalog-store";
import { ConfirmProvider } from "@/lib/confirm";
import { PrintProvider } from "@/lib/print";
import { DataBootstrap } from "@/components/data-bootstrap";
import { Shell } from "@/components/shell";

export default function Home() {
  return (
    <LanguageProvider>
      <DataBootstrap>
        <InvoiceProvider>
          <CustomersProvider>
            <InvoicesProvider>
              <CatalogProvider>
                <ConfirmProvider>
                  <PrintProvider>
                    <Shell />
                  </PrintProvider>
                </ConfirmProvider>
              </CatalogProvider>
            </InvoicesProvider>
          </CustomersProvider>
        </InvoiceProvider>
      </DataBootstrap>
    </LanguageProvider>
  );
}
