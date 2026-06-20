import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Sidebar } from "../component/sidebar/sidebar";
import { Chatbox } from "../component/chatbox/chatbox";
import { ChatService } from "../services/chat.service";

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
  imports: [CommonModule, Sidebar, Chatbox],
  host: {
    class: 'block w-full flex-1 min-h-0 overflow-hidden'
  }
})
export class Home {
  readonly chatService = inject(ChatService);
}

