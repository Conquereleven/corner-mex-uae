import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BUSINESS_TYPES,
  QUANTITY_INTERESTS,
  quantityInterestLabel,
  type ManualQuoteRequestErrors,
  type ManualQuoteRequestFields,
} from "@/features/b2b-catalog/manual-quote-request";

const EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

export function ManualQuoteRequestForm({
  fields,
  errors,
  selectedCount,
  onChange,
  onPrepare,
}: {
  fields: ManualQuoteRequestFields;
  errors: ManualQuoteRequestErrors;
  selectedCount: number;
  onChange: <Key extends keyof ManualQuoteRequestFields>(
    field: Key,
    value: ManualQuoteRequestFields[Key],
  ) => void;
  onPrepare: () => void;
}) {
  return (
    <section aria-labelledby="request-details-heading" className="mt-10">
      <div>
        <span className="text-[11px] uppercase tracking-[0.18em] text-primary">
          Request details
        </span>
        <h2 id="request-details-heading" className="mt-1 font-display text-3xl text-foreground">
          Tell us about your business
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Review these details before submitting. CornerMex stores the enquiry only after you press
          Submit enquiry on the next step.
        </p>
      </div>

      {Object.keys(errors).length > 0 && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"
        >
          Complete the highlighted fields before reviewing the request.
        </div>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Business name" error={errors.businessName}>
          <Input
            value={fields.businessName}
            onChange={(event) => onChange("businessName", event.target.value)}
            aria-invalid={Boolean(errors.businessName)}
            className="min-h-11"
            autoComplete="organization"
          />
        </Field>
        <Field label="Business type" error={errors.businessType}>
          <select
            value={fields.businessType}
            onChange={(event) =>
              onChange(
                "businessType",
                event.target.value as ManualQuoteRequestFields["businessType"],
              )
            }
            aria-invalid={Boolean(errors.businessType)}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Select business type</option>
            {BUSINESS_TYPES.map((businessType) => (
              <option key={businessType} value={businessType}>
                {businessType}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contact person" error={errors.contactPerson}>
          <Input
            value={fields.contactPerson}
            onChange={(event) => onChange("contactPerson", event.target.value)}
            aria-invalid={Boolean(errors.contactPerson)}
            className="min-h-11"
            autoComplete="name"
          />
        </Field>
        <Field label="Role">
          <Input
            value={fields.role}
            onChange={(event) => onChange("role", event.target.value)}
            className="min-h-11"
            autoComplete="organization-title"
          />
        </Field>
        <Field label="Emirate" error={errors.emirate}>
          <select
            value={fields.emirate}
            onChange={(event) => onChange("emirate", event.target.value)}
            aria-invalid={Boolean(errors.emirate)}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Select emirate</option>
            {EMIRATES.map((emirate) => (
              <option key={emirate} value={emirate}>
                {emirate}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            value={fields.email}
            onChange={(event) => onChange("email", event.target.value)}
            aria-invalid={Boolean(errors.email)}
            className="min-h-11"
            autoComplete="email"
          />
        </Field>
        <Field label="Phone or WhatsApp">
          <Input
            type="tel"
            value={fields.phone}
            onChange={(event) => onChange("phone", event.target.value)}
            className="min-h-11"
            autoComplete="tel"
          />
        </Field>
        <Field label="Quantity interest">
          <select
            value={fields.quantityInterest}
            onChange={(event) =>
              onChange(
                "quantityInterest",
                event.target.value as ManualQuoteRequestFields["quantityInterest"],
              )
            }
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {QUANTITY_INTERESTS.map((interest) => (
              <option key={interest} value={interest}>
                {quantityInterestLabel(interest)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea
            value={fields.notes}
            onChange={(event) => onChange("notes", event.target.value)}
            className="min-h-28 resize-y"
            placeholder="Products, presentation preferences, target volume, or other context"
          />
        </Field>
      </div>

      {errors.products && <p className="mt-4 text-sm text-primary">{errors.products}</p>}
      <Button
        type="button"
        size="lg"
        onClick={onPrepare}
        disabled={selectedCount === 0}
        className="mt-7 min-h-11 w-full rounded-full sm:w-auto"
      >
        <ClipboardCheck className="me-2 h-4 w-4" /> Review quote request
      </Button>
    </section>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Label className={`block space-y-2 ${className ?? ""}`}>
      <span>{label}</span>
      {children}
      {error && <span className="block text-xs font-normal text-primary">{error}</span>}
    </Label>
  );
}
