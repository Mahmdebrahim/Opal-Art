import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronRight, Save, MapPin, Plus } from "lucide-react";
import toast from "../../../services/toast.service";
import {
  useCreateArtwork,
  useUpdateArtwork,
  useArtwork,
  useGetMyAddress,
} from "../hooks/useDashboard";
import {
  CATEGORIES,
  PAINT_TYPES,
  CANVAS_THICKNESS_OPTIONS,
  DIMENSION_TYPES,
} from "../config/categories";
import { ROUTES } from "../../../config/routes";
import Button from "../../../components/Ui/Button";
import ImageUploader from "../components/ImageUploader";
import TagsInput from "../components/TagsInput";

// ═══════════════════════════════════════════════════
// Validation Schema
// ═══════════════════════════════════════════════════
const artworkSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "العنوان مطلوب")
    .max(100, "العنوان لا يتجاوز 100 حرف"),
  description: z
    .string()
    .trim()
    .min(1, "الوصف مطلوب")
    .max(2000, "الوصف لا يتجاوز 2000 حرف"),
  price: z.coerce
    .number({ invalid_type_error: "السعر يجب أن يكون رقماً" })
    .min(1, "السعر يجب أن يكون 1 ر.س على الأقل")
    .max(5000, "السعر لا يمكن أن يتجاوز 5,000 ر.س"),
  weight: z.coerce
    .number({ invalid_type_error: "الوزن يجب أن يكون رقماً" })
    .min(0.1, "الوزن يجب أن يكون 0.1 كجم على الأقل"),
  width: z.coerce
    .number({ invalid_type_error: "العرض مطلوب" })
    .min(0.1, "العرض مطلوب"),
  height: z.coerce
    .number({ invalid_type_error: "الارتفاع مطلوب" })
    .min(0.1, "الارتفاع مطلوب"),
  depth: z.coerce
    .number({ invalid_type_error: "العمق يجب أن يكون رقماً" })
    .min(0, "العمق لا يمكن أن يكون سالباً")
    .optional()
    .or(z.literal(0)),
  category: z.string().min(1, "التصنيف الفني مطلوب"),
  paintType: z.string().min(1, "نوع الألوان مطلوب"),
  canvasThickness: z.string().min(1, "سماكة قماش الكانفاس مطلوبة"),
  dimensionType: z.enum(["2D", "3D"]).default("2D"),
  medium: z
    .string()
    .trim()
    .max(100, "الوسيط لا يتجاوز 100 حرف")
    .optional()
    .or(z.literal("")),
});

const inputClass =
  "w-full p-3 bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/50 focus:border-[var(--color-primary)] focus:outline-none transition-colors text-sm rounded-lg";

// ═══════════════════════════════════════════════════
// Field Component
// ═══════════════════════════════════════════════════
function Field({ label, error, required, children, hint }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && (
        <p className="text-xs text-[var(--color-on-surface-variant)]/70">
          {hint}
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════
export default function ArtistArtworkFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: address, isLoading: isAddressLoading } = useGetMyAddress();
  console.log(address);
  const hasAddress =
    address && address.city && address.district && address.street;

  const createMutation = useCreateArtwork();
  const updateMutation = useUpdateArtwork();
  const { data: existingArtwork, isLoading: isArtworkLoading } = useArtwork(id);

  const artworkData = existingArtwork?.artwork || existingArtwork;

  const [files, setFiles] = useState([]);
  const [keptExisting, setKeptExisting] = useState([]);
  const [tags, setTags] = useState([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(artworkSchema),
    defaultValues: {
      title: "",
      description: "",
      price: "",
      weight: "",
      width: "",
      height: "",
      depth: "",
      category: "",
      paintType: "",
      canvasThickness: "",
      dimensionType: "2D",
      medium: "",
    },
  });

  useEffect(() => {
    if (isEdit && artworkData) {
      reset({
        title: artworkData.title || "",
        description: artworkData.description || "",
        price: artworkData.price || "",
        weight: artworkData.weight || "",
        width: artworkData.dimensions?.width || "",
        height: artworkData.dimensions?.height || "",
        depth: artworkData.dimensions?.depth || "",
        category: artworkData.category || "",
        paintType: artworkData.paintType || "",
        canvasThickness: artworkData.canvasThickness || "",
        dimensionType: artworkData.dimensionType || "2D",
        medium: artworkData.medium || "",
      });
      setTags(artworkData.tags || []);
      setKeptExisting(artworkData.images || []);
    }
  }, [isEdit, artworkData, reset]);

  const onSubmit = (data) => {
    if (keptExisting.length + files.length === 0) {
      toast.error("اللوحة لازم يكون فيها صورة واحدة على الأقل");
      return;
    }

    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("description", data.description);
    formData.append("price", data.price);
    formData.append("weight", data.weight);
    formData.append(
      "dimensions",
      JSON.stringify({
        width: Number(data.width),
        height: Number(data.height),
        depth: Number(data.depth) || 0,
      }),
    );
    formData.append("category", data.category);
    formData.append("paintType", data.paintType);
    formData.append("canvasThickness", data.canvasThickness);
    formData.append("dimensionType", data.dimensionType);
    if (data.medium) formData.append("medium", data.medium);
    if (tags.length > 0) formData.append("tags", JSON.stringify(tags));
    formData.append(
      "existingImageKeys",
      JSON.stringify(keptExisting.map((i) => i.key)),
    );
    files.forEach((file) => formData.append("images", file));

    if (isEdit) {
      updateMutation.mutate(
        { id, formData },
        {
          onSuccess: (data) => {
            const msg =
              data?.data?.message || data?.message || "تم تحديث اللوحة بنجاح";
            navigate(ROUTES.MY_ARTWORKS);
          },
        },
      );
    } else {
      createMutation.mutate(formData, {
        onSuccess: (data) => {
          navigate(ROUTES.MY_ARTWORKS);
        },
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // ✅ Skeleton Loading
  if ((isEdit && isArtworkLoading) || isAddressLoading) {
    return <FormSkeleton isEdit={isEdit} />;
  }

  // ✅ Block لو مفيش address (في الـ create فقط)
  if (!isEdit && !hasAddress) {
    return <NoAddressBlock />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center gap-3">
        <Link
          to={ROUTES.MY_ARTWORKS}
          className="p-2 rounded-lg text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-low)] transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--color-on-surface)]">
            {isEdit ? "تعديل اللوحة" : "رفع لوحة جديدة"}
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)] mt-0.5">
            {isEdit
              ? "عدّل تفاصيل لوحتك الفنية"
              : "أضف لوحة فنية جديدة لتظهر في المعرض"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* ═══ Section 1: الصور ═══ */}
        <section className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-xl p-6">
          <h2 className="text-base font-display font-semibold text-[var(--color-on-surface)] mb-4">
            صور اللوحة <span className="text-red-500">*</span>
          </h2>
          <ImageUploader
            files={files}
            setFiles={setFiles}
            keptExisting={keptExisting}
            setKeptExisting={setKeptExisting}
            maxFiles={10}
          />
        </section>

        {/* ═══ Section 2: المعلومات الأساسية ═══ */}
        <section className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-xl p-6 space-y-5">
          <h2 className="text-base font-display font-semibold text-[var(--color-on-surface)]">
            المعلومات الأساسية
          </h2>
          <Field label="عنوان اللوحة" required error={errors.title?.message}>
            <input
              type="text"
              {...register("title")}
              placeholder="مثال: غروب على شاطئ جدة"
              className={inputClass}
            />
          </Field>
          <Field label="الوصف" required error={errors.description?.message}>
            <textarea
              {...register("description")}
              rows={5}
              placeholder="اكتب وصفاً تفصيلياً للوحة: الفكرة، الخامات، الإلهام..."
              className={`${inputClass} resize-none`}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field
              label="السعر (ر.س)"
              required
              error={errors.price?.message}
              hint="حد أقصى 5,000 ر.س للفترة التجريبية"
            >
              <input
                type="number"
                min="0"
                step="1"
                {...register("price")}
                placeholder="1500"
                className={inputClass}
              />
            </Field>
            <Field label="الوزن (كجم)" required error={errors.weight?.message}>
              <input
                type="number"
                min="0"
                step="0.1"
                {...register("weight")}
                placeholder="2.5"
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        {/* ═══ Section 3: الأبعاد ═══ */}
        <section className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-xl p-6 space-y-5">
          <h2 className="text-base font-display font-semibold text-[var(--color-on-surface)]">
            الأبعاد ونوع اللوحة
          </h2>
          <Field
            label="نوع أبعاد اللوحة (2D / 3D)"
            error={errors.dimensionType?.message}
          >
            <div className="flex gap-4">
              {DIMENSION_TYPES.map((dim) => (
                <label
                  key={dim.value}
                  className="flex items-center gap-2 cursor-pointer text-sm font-medium"
                >
                  <input
                    type="radio"
                    value={dim.value}
                    {...register("dimensionType")}
                    className="w-4 h-4 accent-[var(--color-primary)] cursor-pointer"
                  />
                  <span>{dim.label}</span>
                </label>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="العرض (سم)" required error={errors.width?.message}>
              <input
                type="number"
                min="0"
                step="0.1"
                {...register("width")}
                placeholder="80"
                className={inputClass}
              />
            </Field>
            <Field
              label="الارتفاع (سم)"
              required
              error={errors.height?.message}
            >
              <input
                type="number"
                min="0"
                step="0.1"
                {...register("height")}
                placeholder="60"
                className={inputClass}
              />
            </Field>
            <Field label="العمق (سم)" error={errors.depth?.message}>
              <input
                type="number"
                min="0"
                step="0.1"
                {...register("depth")}
                placeholder="0"
                className={inputClass}
              />
            </Field>
          </div>
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            💡 لو أي بُعد أكبر من 120 سم، اللوحة هتتصنف كـ "شحن عملاق" تلقائياً.
          </p>
        </section>

        {/* ═══ Section 4: المواصفات ═══ */}
        <section className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-xl p-6 space-y-5">
          <h2 className="text-base font-display font-semibold text-[var(--color-on-surface)]">
            مواصفات اللوحة والتصنيف
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field
              label="التصنيف الفني"
              required
              error={errors.category?.message}
            >
              <select
                {...register("category")}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">اختر التصنيف</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="نوع الألوان المستخدمة"
              required
              error={errors.paintType?.message}
            >
              <select
                {...register("paintType")}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">اختر نوع الألوان</option>
                {PAINT_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field
              label="سماكة قماش الكانفاس"
              required
              error={errors.canvasThickness?.message}
            >
              <select
                {...register("canvasThickness")}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">اختر سماكة الكانفاس</option>
                {CANVAS_THICKNESS_OPTIONS.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="الوسيط / خامات إضافية"
              error={errors.medium?.message}
              hint="ألوان زيتية، أوراق ذهب على قماش..."
            >
              <input
                type="text"
                {...register("medium")}
                placeholder="تفاصيل إضافية للخامات"
                className={inputClass}
              />
            </Field>
          </div>
          <Field
            label="الوسوم (Tags)"
            hint="تساعد المشترين يلاقوا لوحتك في البحث"
          >
            <TagsInput tags={tags} setTags={setTags} />
          </Field>
        </section>

        {/* ═══ Submit ═══ */}
        <div className="flex gap-3">
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isPending}
            icon={Save}
          >
            {isEdit ? "حفظ التعديلات" : "نشر اللوحة"}
          </Button>
          <Link to={ROUTES.MY_ARTWORKS}>
            <Button type="button" variant="outline" size="md">
              إلغاء
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// No Address Block
// ═══════════════════════════════════════════════════
function NoAddressBlock() {
  return (
    <div className="max-w-xl mx-auto">
      <div className="p-8 md:p-10 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
          <MapPin className="w-10 h-10 text-amber-600" strokeWidth={1.5} />
        </div>

        <h1 className="font-display text-2xl font-bold text-[var(--color-on-surface)] mb-3">
          أضف عنوان الشحن أولاً
        </h1>

        <p className="text-sm text-[var(--color-on-surface-variant)] leading-relaxed mb-8 max-w-md mx-auto">
          عشان نضمن توصيل لوحاتك ووصول مشترياتك بأمان، محتاجين عنوان شحن واحد
          على الأقل مسجل في حسابك قبل ما تبدأ رفع لوحاتك الفنية.
        </p>

        <div className="bg-[var(--color-surface-container-low)]/50 border border-[var(--color-outline-variant)]/30 rounded-xl p-4 mb-8 text-right space-y-2">
          <p className="text-xs font-semibold text-[var(--color-on-surface)] mb-2">
            ليه محتاجين العنوان؟
          </p>
          <ul className="text-xs text-[var(--color-on-surface-variant)] space-y-1.5 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-[var(--color-primary)] mt-0.5">•</span>
              <span>حساب تكلفة الشحن للعميل للوحات اللي بتبيعها</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--color-primary)] mt-0.5">•</span>
              <span>توصيل اللوحات اللي بتشتريها</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--color-primary)] mt-0.5">•</span>
              <span>استلام وتسليم الشحنة الى شركة الشحن من عنوانك</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to={ROUTES.ADDRESS || "/profile/addresses"}>
            <Button variant="primary" size="md" icon={Plus} fullWidth>
              أضف عنوان الشحن
            </Button>
          </Link>
          <Link to={ROUTES.MY_ARTWORKS}>
            <Button variant="outline" size="md" fullWidth>
              العودة للوحاتي
            </Button>
          </Link>
        </div>

        <p className="text-[11px] text-[var(--color-on-surface-variant)]/60 mt-6">
          بعد إضافة العنوان، هتقدر تبدأ رفع لوحاتك فوراً
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Loading Skeleton
// ═══════════════════════════════════════════════════
function FormSkeleton({ isEdit }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg">
          <div className="w-5 h-5 bg-[var(--color-surface-container-low)] rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-7 w-40 bg-[var(--color-surface-container-low)] rounded" />
          <div className="h-4 w-56 bg-[var(--color-surface-container-low)] rounded" />
        </div>
      </div>

      <section className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-28 bg-[var(--color-surface-container-low)] rounded" />
          <div className="w-2 h-2 bg-red-500 rounded-full" />
        </div>
        <div className="border-2 border-dashed border-[var(--color-outline-variant)]/40 rounded-xl p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-[var(--color-surface-container-low)] rounded-xl flex items-center justify-center">
              <div className="w-7 h-7 bg-[var(--color-surface-container-lowest)] rounded" />
            </div>
            <div className="space-y-2 text-center">
              <div className="h-4 w-48 bg-[var(--color-surface-container-low)] rounded mx-auto" />
              <div className="h-3 w-32 bg-[var(--color-surface-container-low)] rounded mx-auto" />
            </div>
            <div className="h-10 w-40 bg-[var(--color-surface-container-low)] rounded-lg mt-2" />
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-xl p-6 space-y-5">
        <div className="h-5 w-40 bg-[var(--color-surface-container-low)] rounded" />
        <div className="space-y-1.5">
          <div className="h-3 w-24 bg-[var(--color-surface-container-low)] rounded" />
          <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-16 bg-[var(--color-surface-container-low)] rounded" />
          <div className="h-32 bg-[var(--color-surface-container-low)] rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <div className="h-3 w-20 bg-[var(--color-surface-container-low)] rounded" />
            <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg" />
            <div className="h-3 w-48 bg-[var(--color-surface-container-low)] rounded" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-20 bg-[var(--color-surface-container-low)] rounded" />
            <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg" />
          </div>
        </div>
      </section>

      <section className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-xl p-6 space-y-5">
        <div className="h-5 w-36 bg-[var(--color-surface-container-low)] rounded" />
        <div className="space-y-1.5">
          <div className="h-3 w-32 bg-[var(--color-surface-container-low)] rounded" />
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[var(--color-surface-container-low)] rounded-full" />
              <div className="h-4 w-8 bg-[var(--color-surface-container-low)] rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[var(--color-surface-container-low)] rounded-full" />
              <div className="h-4 w-8 bg-[var(--color-surface-container-low)] rounded" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <div className="h-3 w-20 bg-[var(--color-surface-container-low)] rounded" />
            <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-24 bg-[var(--color-surface-container-low)] rounded" />
            <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-20 bg-[var(--color-surface-container-low)] rounded" />
            <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg" />
          </div>
        </div>
        <div className="h-3 w-full max-w-md bg-[var(--color-surface-container-low)] rounded" />
      </section>

      <section className="bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/40 rounded-xl p-6 space-y-5">
        <div className="h-5 w-40 bg-[var(--color-surface-container-low)] rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <div className="h-3 w-28 bg-[var(--color-surface-container-low)] rounded" />
            <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-36 bg-[var(--color-surface-container-low)] rounded" />
            <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <div className="h-3 w-40 bg-[var(--color-surface-container-low)] rounded" />
            <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-32 bg-[var(--color-surface-container-low)] rounded" />
            <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg" />
            <div className="h-3 w-44 bg-[var(--color-surface-container-low)] rounded" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-24 bg-[var(--color-surface-container-low)] rounded" />
          <div className="h-12 bg-[var(--color-surface-container-low)] rounded-lg" />
          <div className="h-3 w-56 bg-[var(--color-surface-container-low)] rounded" />
        </div>
      </section>

      <div className="flex gap-3">
        <div className="h-11 w-36 bg-[var(--color-surface-container-low)] rounded-lg" />
        <div className="h-11 w-24 bg-[var(--color-surface-container-low)] rounded-lg" />
      </div>
    </div>
  );
}
