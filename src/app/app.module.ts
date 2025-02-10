import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';

import { AppComponent } from './app.component';
import { ChatAssistantComponent } from './components/chat-assistant/chat-assistant.component';
import { OpenAIService } from './services/openai.service';
import { ThemenbaumService } from './services/themenbaum.service';

@NgModule({
  declarations: [
    AppComponent,
    ChatAssistantComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    CommonModule
  ],
  providers: [
    OpenAIService,
    ThemenbaumService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
