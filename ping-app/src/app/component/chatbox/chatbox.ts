import { Component, inject, viewChild, ElementRef, effect, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faSearch, 
  faSmile, 
  faPaperPlane,
  faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-chatbox',
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './chatbox.html',
  styleUrls: ['./chatbox.css'],
  host: {
    class: 'block w-full h-full'
  }
})
export class Chatbox {
  readonly chatService = inject(ChatService);

  faSearch = faSearch;
  faSmile = faSmile;
  faPaperPlane = faPaperPlane;
  faArrowLeft = faArrowLeft;

  messageText = signal<string>('');
  showEmojiPicker = signal<boolean>(false);
  recentEmojis = signal<string[]>([]);
  
  readonly emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
    '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️',
    '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
    '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓',
    '🤗', '🤔', '🫣', '🤭', '🫢', '🤫', '🤥', '😶', '😶‍🌫️', '😐',
    '😑', '😬', '🫨', '🫠', '🙄', '😯', '😦', '😧', '😮', '😲',
    '🥱', '😴', '🤤', '😪', '😵', '😵‍💫', '🤐', '🥴', '🤢', '🤮',
    '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺',
    '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺',
    '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋', '🤚',
    '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟',
    '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎',
    '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏',
    '✍️', '💅', '🤳', '💪', '🦾', '❤️', '🧡', '💛', '💚', '💙',
    '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞',
    '💓', '💗', '💖', '💘', '💝', '💟', '💬', '💭', '🗯️', '🔇',
    '🔈', '🔉', '🔊', '🔔', '🔕', '🎉', '🎊', '🎈', '🎂', '🎁'
  ];

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const clickedInside = target.closest('.emoji-container') || target.closest('.emoji-toggle-btn');
    if (!clickedInside) {
      this.showEmojiPicker.set(false);
    }
  }

  // Get reactive element reference for scrolling
  scrollContainer = viewChild<ElementRef>('scrollContainer');

  constructor() {
    // Load recent emojis from localStorage
    const saved = localStorage.getItem('ping_recent_emojis');
    if (saved) {
      try {
        this.recentEmojis.set(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }

    // Scroll to bottom automatically whenever messages change
    effect(() => {
      const activeChat = this.chatService.activeChat();
      const messages = activeChat?.messages;
      
      setTimeout(() => {
        this.scrollToBottom();
      }, 50);
    });
  }

  scrollToBottom() {
    const el = this.scrollContainer()?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  addEmoji(emoji: string) {
    this.messageText.update(text => text + emoji);
    const currentRecent = this.recentEmojis();
    const updated = [emoji, ...currentRecent.filter(e => e !== emoji)].slice(0, 16);
    this.recentEmojis.set(updated);
    localStorage.setItem('ping_recent_emojis', JSON.stringify(updated));
  }

  onSend() {
    const text = this.messageText();
    if (text.trim()) {
      this.chatService.sendMessage(text);
      this.messageText.set('');
      this.showEmojiPicker.set(false);
    }
  }
}

