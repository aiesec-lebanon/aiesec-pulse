import Image from "next/image";
import Link from "next/link";

import { type BlockNode, sanitiseDocument, type TextNode } from "@/lib/content/document";

// mediaId -> public URL. Sanitisation keeps a document's image blocks even
// when the id doesn't resolve to anything (resolution is deliberately not
// sanitisation's job); a caller that hasn't looked up media yet simply
// passes nothing, and those blocks render as nothing rather than broken img.
export type MediaLookup = Record<string, string>;

// Re-sanitised on read as well as write, so a row from an older build or a
// migration cannot turn a stored-content bug into stored XSS.
export function DocumentRenderer({ doc, media = {} }: { doc: unknown; media?: MediaLookup }) {
  const document = sanitiseDocument(doc);

  if (document.content.length === 0) {
    return (
      <p className="text-[16px] italic text-[var(--muted-foreground)]">This post has no content.</p>
    );
  }

  return <>{document.content.map((node, i) => renderBlock(node, i, media))}</>;
}

function renderBlock(node: BlockNode, key: number, media: MediaLookup): React.ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} className="mb-4 text-[18px] leading-[1.7] text-[var(--foreground)] last:mb-0">
          {renderInline(node.content)}
        </p>
      );

    case "heading": {
      const level = node.attrs?.level ?? 2;
      const className =
        level === 2
          ? "mt-8 mb-3 text-[24px] font-bold leading-tight text-[var(--foreground)]"
          : level === 3
            ? "mt-6 mb-2 text-[20px] font-bold leading-tight text-[var(--foreground)]"
            : "mt-5 mb-2 text-[18px] font-bold leading-tight text-[var(--foreground)]";
      if (level === 2)
        return (
          <h2 key={key} className={className}>
            {renderInline(node.content)}
          </h2>
        );
      if (level === 3)
        return (
          <h3 key={key} className={className}>
            {renderInline(node.content)}
          </h3>
        );
      return (
        <h4 key={key} className={className}>
          {renderInline(node.content)}
        </h4>
      );
    }

    case "blockquote":
      return (
        <blockquote
          key={key}
          className="my-6 border-l-2 border-[var(--primary)] pl-5 text-[18px] italic leading-[1.7] text-[var(--muted-foreground)]"
        >
          {node.content?.map((child, i) => renderBlock(child, i, media))}
        </blockquote>
      );

    case "bulletList":
      return (
        <ul
          key={key}
          className="my-4 list-disc pl-6 text-[18px] leading-[1.7] text-[var(--foreground)]"
        >
          {node.content?.map((child, i) => renderBlock(child, i, media))}
        </ul>
      );

    case "orderedList":
      return (
        <ol
          key={key}
          className="my-4 list-decimal pl-6 text-[18px] leading-[1.7] text-[var(--foreground)]"
        >
          {node.content?.map((child, i) => renderBlock(child, i, media))}
        </ol>
      );

    case "listItem":
      return (
        <li key={key} className="mb-1">
          {node.content?.map((child, i) => renderBlock(child, i, media))}
        </li>
      );

    case "image": {
      const url = media[node.attrs.mediaId];
      if (!url) return null;
      return (
        <figure key={key} className="my-6">
          <span className="block overflow-hidden rounded-[var(--radius-lg)]">
            <Image
              src={url}
              alt={node.attrs.alt}
              width={720}
              height={405}
              className="h-auto w-full object-cover"
            />
          </span>
        </figure>
      );
    }

    default:
      return null;
  }
}

function renderInline(nodes: TextNode[] | undefined): React.ReactNode {
  if (!nodes) return null;

  return nodes.map((node, i) => {
    let element: React.ReactNode = node.text;

    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case "bold":
          element = <strong>{element}</strong>;
          break;
        case "italic":
          element = <em>{element}</em>;
          break;
        case "strike":
          element = <s>{element}</s>;
          break;
        case "code":
          element = (
            <code className="rounded-[var(--radius-sm)] bg-[var(--muted)] px-1.5 py-0.5 text-[0.9em]">
              {element}
            </code>
          );
          break;
        case "link": {
          const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : null;
          if (!href) break;
          // Untrusted destinations: noopener blocks reverse tabnabbing, nofollow
          // refuses to lend the site's reputation.
          element = (
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-[var(--primary-text)] underline decoration-[var(--primary)]/40 underline-offset-2 hover:decoration-[var(--primary)]"
            >
              {element}
            </Link>
          );
          break;
        }
      }
    }

    return <span key={i}>{element}</span>;
  });
}
