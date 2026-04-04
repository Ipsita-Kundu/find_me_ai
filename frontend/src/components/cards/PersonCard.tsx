import type { PersonRecord } from "@/types";

interface PersonCardProps {
  person: PersonRecord;
}

export default function PersonCard({ person }: PersonCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  <div
    className="h-44 w-full bg-cover"
    style={{ backgroundImage: `url(${person.imageUrl})` }}
  ></div>

  <div className="p-4">
    <h3 className="text-lg font-bold text-slate-900">{person.name}</h3>

    {person.age ? (
      <p className="text-sm text-slate-600">
        Age {person.age} {person.gender ? `• ${person.gender}` : ""}
      </p>
    ) : null}

    {person.location ? (
      <p className="mt-2 text-sm text-slate-600">
        Location: {person.location}
      </p>
    ) : null}

    <p className="mt-2 text-sm text-slate-700">{person.description}</p>

    {person.contact ? (
      <p className="mt-2 text-xs font-semibold text-slate-500">
        Contact: {person.contact}
      </p>
    ) : null}
  </div>
</article>
  );
}
