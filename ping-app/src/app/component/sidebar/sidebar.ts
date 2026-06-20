import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { 
  faPlus, 
  faSearch,
  faCog,
  faTimes,
  faUserPlus
} from '@fortawesome/free-solid-svg-icons';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, FormsModule, FontAwesomeModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
  host: {
    class: 'block w-full h-full'
  }
})
export class Sidebar {
  readonly chatService = inject(ChatService);

  faPlus = faPlus;
  faSearch = faSearch;
  faCog = faCog;
  faTimes = faTimes;
  faUserPlus = faUserPlus;

  // Add Contact Section State
  newContactMobile = signal<string>('');
  addContactError = signal<string>('');

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.chatService.searchQuery.set(value);
  }

  selectChat(id: number) {
    this.chatService.selectChat(id);
  }

  goToSettings() {
    this.chatService.activeView.set('settings');
  }

  toggleAddContact() {
    this.chatService.showAddContact.update(val => !val);
    this.newContactMobile.set('');
    this.addContactError.set('');
  }

  addContact() {
    const mobile = this.newContactMobile().trim();

    if (!mobile) {
      this.addContactError.set('Mobile number is required.');
      return;
    }

    if (mobile.length < 7) {
      this.addContactError.set('Please enter a valid mobile number.');
      return;
    }

    this.chatService.addContactByMobile(mobile).subscribe({
      next: (chat) => {
        if (chat) {
          // Success, reset panel
          this.toggleAddContact();
        }
      },
      error: (err) => {
        console.error(err);
        this.addContactError.set(err.error?.error || 'Failed to initiate chat.');
      }
    });
  }
}



