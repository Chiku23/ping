import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faArrowLeft, 
  faUser, 
  faEnvelope, 
  faPhone, 
  faSignOutAlt, 
  faCheck 
} from '@fortawesome/free-solid-svg-icons';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.css'],
  host: {
    class: 'block w-full flex-1 min-h-0'
  }
})
export class Settings implements OnInit {
  readonly chatService = inject(ChatService);

  faArrowLeft = faArrowLeft;
  faUser = faUser;
  faEnvelope = faEnvelope;
  faPhone = faPhone;
  faSignOutAlt = faSignOutAlt;
  faCheck = faCheck;

  nameInput = signal<string>('');
  saveSuccess = signal<boolean>(false);

  themes = [
    { id: 'purple', name: 'Purple Dream', color: '#8b5cf6' },
    { id: 'emerald', name: 'WhatsApp Emerald', color: '#00a884' },
    { id: 'cyberpunk', name: 'Neon Cyberpunk', color: '#ff007f' },
    { id: 'sunset', name: 'Sunset Orange', color: '#f97316' },
    { id: 'blue', name: 'Electric Blue', color: '#3b82f6' },
    { id: 'rose', name: 'Crimson Rose', color: '#f43f5e' },
    { id: 'emerald-sage', name: 'Forest Sage', color: '#10b981' },
    { id: 'teal', name: 'Teal Breeze', color: '#0d9488' },
    { id: 'nord', name: 'Nordic Frost', color: '#88c0d0' },
    { id: 'lavender', name: 'Lavender Dream', color: '#a78bfa' }
  ];

  changeTheme(themeId: string) {
    this.chatService.setTheme(themeId);
  }

  ngOnInit() {
    const profile = this.chatService.currentUser();
    if (profile) {
      this.nameInput.set(profile.name);
    }
  }

  onSave() {
    const updatedName = this.nameInput().trim();
    if (!updatedName) return;

    this.chatService.updateProfileName(updatedName);
    this.saveSuccess.set(true);
    setTimeout(() => {
      this.saveSuccess.set(false);
    }, 2000);
  }

  onLogout() {
    this.chatService.logout();
  }

  goBack() {
    this.chatService.activeView.set('chat');
  }
}
