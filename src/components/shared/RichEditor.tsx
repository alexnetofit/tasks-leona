import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { IconBold, IconItalic, IconStrikethrough, IconH1, IconH2, IconList, IconListNumbers, IconBlockquote, IconCode } from '@tabler/icons-react';

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  onImagePaste?: (file: File) => Promise<string | undefined>;
  onImageClick?: (src: string) => void;
  placeholder?: string;
}

export default function RichEditor({ value, onChange, onBlur, onImagePaste, onImageClick, placeholder = 'Escreva aqui...' }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: 'editor-image' } }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: true }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onBlur: () => onBlur?.(),
    editorProps: {
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            event.preventDefault();
            const file = items[i].getAsFile();
            if (file && onImagePaste) {
              onImagePaste(file).then((url) => { if (url && editor) editor.chain().focus().setImage({ src: url }).run(); });
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.startsWith('image/') && onImagePaste) {
            event.preventDefault();
            onImagePaste(files[i]).then((url) => { if (url && editor) editor.chain().focus().setImage({ src: url }).run(); });
            return true;
          }
        }
        return false;
      },
      handleClick: (view, pos, event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'IMG' && onImageClick) { onImageClick((target as HTMLImageElement).src); return true; }
        return false;
      },
    },
  });

  if (!editor) return null;

  const Btn = ({ icon: Icon, onClick, active, title }: { icon: any; onClick: () => void; active?: boolean; title: string }) => (
    <button className={`tiptap-toolbar-btn ${active ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); onClick(); }} type="button" title={title}><Icon size={16} /></button>
  );

  return (
    <div className="tiptap-editor">
      <div className="tiptap-toolbar">
        <Btn icon={IconBold} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito" />
        <Btn icon={IconItalic} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico" />
        <Btn icon={IconStrikethrough} onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado" />
        <div className="tiptap-toolbar-divider" />
        <Btn icon={IconH1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Título 1" />
        <Btn icon={IconH2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título 2" />
        <div className="tiptap-toolbar-divider" />
        <Btn icon={IconList} onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista" />
        <Btn icon={IconListNumbers} onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada" />
        <Btn icon={IconBlockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citação" />
        <Btn icon={IconCode} onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Código" />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
