import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { generateInvoicePDF } from "@/lib/services/InvoicePDFService";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const { id } = params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        lineItems: true,
        project: {
          include: {
            po: {
              include: {
                client: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const company = {
      name: process.env.COMPANY_NAME ?? "SixD Engineering Solutions Pvt. Ltd.",
      address: process.env.COMPANY_ADDRESS ?? "Noida, Uttar Pradesh, India",
      gstin: process.env.COMPANY_GSTIN ?? "",
      pan: process.env.COMPANY_PAN ?? "",
      email: process.env.COMPANY_EMAIL ?? "info@sixdengineering.com",
      phone: process.env.COMPANY_PHONE ?? "",
      bankName: process.env.COMPANY_BANK_NAME ?? "",
      bankAccount: process.env.COMPANY_BANK_ACCOUNT ?? "",
      bankIFSC: process.env.COMPANY_BANK_IFSC ?? "",
      bankBranch: process.env.COMPANY_BANK_BRANCH ?? "",
    };

    const pdfData = {
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt ?? new Date(),
      dueDate: invoice.dueDate ?? undefined,
      client: {
        name: invoice.project.po.client.name,
        gstin: invoice.project.po.client.gstin ?? undefined,
      },
      project: {
        projectId: invoice.project.projectId,
        title: invoice.project.title,
        po: { poNumber: invoice.project.po.poNumber },
      },
      lineItems: invoice.lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: li.amount,
      })),
      subtotal: invoice.subtotal,
      gstPercent: invoice.project.po.client.gstPercent,
      gstAmount: invoice.gstAmount,
      totalAmount: invoice.totalAmount,
      paidAmount: invoice.paidAmount,
      company,
      notes: invoice.notes ?? undefined,
    };

    const pdfBuffer = await generateInvoicePDF(pdfData);

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[Invoice PDF]", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
