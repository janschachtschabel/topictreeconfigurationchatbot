import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
}

@Injectable({
  providedIn: 'root'
})
export class OpenAIService {
  private readonly headers: HttpHeaders;

  constructor(private http: HttpClient) {
    this.headers = new HttpHeaders()
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${environment.openai.apiKey}`);
  }

  sendMessage(messages: ChatMessage[]): Observable<any> {
    const url = `${environment.openai.baseUrl}/chat/completions`;
    
    const payload: ChatCompletionRequest = {
      model: environment.openai.model,
      messages: messages,
      temperature: 0.7
    };

    return this.http.post(url, payload, { headers: this.headers });
  }
}
