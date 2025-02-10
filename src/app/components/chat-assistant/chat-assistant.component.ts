import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { OpenAIService } from '../../services/openai.service';
import { firstValueFrom, Observable, map } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ThemenbaumService } from '../../services/themenbaum.service';
import { DISCIPLINE_MAPPING, EDUCATIONAL_CONTEXT_MAPPING, TARGET_GROUP_MAPPING } from '../../services/mappings';

interface ChatMessage {
  sender: 'user' | 'bot';
  content: string;
}

interface FormState {
  themenbaumthema: string | null;
  hauptkategorien: number | null;
  unterkategorien: number | null;
  weitereUnterkategorien: number | null;
  bildungsstufen: string[];
  fachgebiete: string[];
  zielgruppen: string[];
  freigegeben: boolean;
  zusammenfassungBestaetigt: boolean;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

@Component({
  selector: 'app-chat-assistant',
  templateUrl: './chat-assistant.component.html',
  styleUrls: ['./chat-assistant.component.scss']
})
export class ChatAssistantComponent implements OnInit {
  messages: ChatMessage[] = [];
  userInput = '';
  isLoading = false;
  private lastFreigabeState = false;

  formGroup!: FormGroup;

  // Extrahiere die Labels (ohne URIs) aus den Mappings für die Prompts
  readonly bildungsstufen = Object.keys(EDUCATIONAL_CONTEXT_MAPPING).filter(key => key !== "Keine Vorgabe");
  readonly fachgebiete = Object.keys(DISCIPLINE_MAPPING).filter(key => key !== "Keine Vorgabe");
  readonly zielgruppen = Object.keys(TARGET_GROUP_MAPPING).filter(key => key !== "Keine Vorgabe");

  constructor(
    private formBuilder: FormBuilder,
    private openaiService: OpenAIService,
    private sanitizer: DomSanitizer,
    private themenbaumService: ThemenbaumService
  ) { }

  ngOnInit() {
    this.formGroup = this.formBuilder.group({
      themenbaumthema: [null],
      hauptkategorien: [null],
      unterkategorien: [null],
      weitereUnterkategorien: [null],
      bildungsstufen: [[]],
      fachgebiete: [[]],
      zielgruppen: [[]],
      freigegeben: [false],
      zusammenfassungBestaetigt: [false]
    });
    this.addBotMessage('Hallo! Ich bin Boerdie, ein freundlicher KI-Assistent für die Konfiguration eines Themenbaums für Bildungsinhalte. Ich unterstütze dich bei der Erstellung eines Themenbaums mit 3 Hierarchieebenen: Hauptkategorien, Unterkategorien und weitere Unterkategorien. Bitte beschreibe das Thema, das der Themenbaum repräsentieren soll.');
  }

  private async processUserInput(input: string) {
    this.isLoading = true;

    try {
      // First, handle the chat interaction
      const chatResponse = await firstValueFrom(this.getChatResponse(input));
      const botMessage = (chatResponse as OpenAIResponse).choices[0].message.content;
      this.addBotMessage(botMessage);

      // Then, parse the entire conversation to extract values
      const messages = this.messages.map(msg => msg.content).join('\n');
      const parsedValues = await firstValueFrom(this.parseConversation(messages));

      if (parsedValues) {
        this.updateFormState(parsedValues);
      }

      this.isLoading = false;
    } catch (error) {
      console.error('Error:', error);
      this.addBotMessage('Entschuldigung, es gab einen Fehler bei der Verarbeitung deiner Nachricht.');
      this.isLoading = false;
    }
  }

  private getChatResponse(input: string): Observable<OpenAIResponse> {
    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: this.getChatPrompt()
      }
    ];

    // Add conversation history
    const recentMessages = this.messages.slice(-6).map(msg => ({
      role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: msg.content
    }));
    messages.push(...recentMessages);

    // Add current message
    messages.push({
      role: 'user' as const,
      content: input
    });

    return this.openaiService.sendMessage(messages);
  }

  private getChatPrompt(): string {
    const currentState = this.formGroup.value;
    const nextStep = this.determineNextStep(currentState);
    
    return `Du bist Boerdie, ein freundlicher KI-Assistent für die Konfiguration eines Themenbaums für Bildungsinhalte.

VERFÜGBARE WERTE:
Bildungsstufen: ${this.bildungsstufen.join(', ')}
Fachgebiete: ${this.fachgebiete.join(', ')}
Zielgruppen: ${this.zielgruppen.join(', ')}

AKTUELLER STAND:
${JSON.stringify(currentState, null, 2)}

ABLAUF (Strikt in dieser Reihenfolge):
1. Themenbaumthema erfragen
2. Anzahl der Hauptkategorien festlegen (1-30, Empfehlung: 10-12)
3. Anzahl der Unterkategorien festlegen (0-20)
4. Anzahl der Weiteren Unterkategorien festlegen (0-20)
5. Abfrage, ob man bereits einige Metadaten für den Themenbaum festlegen möchte oder direkt zur Zusammenfassung springen möchte.
6. Optional: Bildungsstufen
7. Optional: Fachgebiete
8. Optional: Zielgruppen
9. Zusammenfassung präsentieren und um Freigabe bitten

NÄCHSTER SCHRITT:
${nextStep}

VERHALTEN:
1. Führe den Benutzer strikt Schritt für Schritt durch den Prozess
2. Stelle immer nur eine Frage auf einmal
3. Zeige nicht alle verfügbaren Werte, sondern bitte den Nutzenden um eine Antwort
4. Bestätige erhaltene Antworten
5. Falls die Eingabe des Nutzenden nicht den verfügbaren Werten entspricht, versuche ihn im Dialog darauf zu orientieren
6. Fasse am Ende alle Eingaben zusammen und bitte um Freigabe
7. Bei Ablehnung der Freigabe, frage nach was geändert werden soll

WICHTIG:
- Bleibe freundlich und hilfsbereit
- Gib Empfehlungen wenn sinnvoll
- Validiere die Eingaben gegen die verfügbaren Werte
- Formatiere deine Antworten in Markdown:
  - Verwende **fett** für wichtige Begriffe
  - Nutze \`code\` für Zahlenwerte
  - Strukturiere mit # und ## für Überschriften
  - Verwende - für Aufzählungen
- Bei der Zusammenfassung:
  1. Präsentiere alle Eingaben übersichtlich
  2. Frage explizit nach Bestätigung der Zusammenfassung
  3. Erst nach Bestätigung der Zusammenfassung nach Freigabe fragen`;
  }

  private parseConversation(conversation: string): Observable<FormState | null> {
    // Aktuellen Formularstand für Kontext hinzufügen
    const currentState = this.formGroup.value;
    const stateInfo = `
AKTUELLER FORMULARSTAND:
- Thema: ${currentState.themenbaumthema || 'nicht gesetzt'}
- Hauptkategorien: ${currentState.hauptkategorien !== null ? currentState.hauptkategorien : 'nicht gesetzt'}
- Unterkategorien: ${currentState.unterkategorien !== null ? currentState.unterkategorien : 'nicht gesetzt'}
- Weitere Unterkategorien: ${currentState.weitereUnterkategorien !== null ? currentState.weitereUnterkategorien : 'nicht gesetzt'}
- Bildungsstufen: ${currentState.bildungsstufen.length > 0 ? currentState.bildungsstufen.join(', ') : 'keine'}
- Fachgebiete: ${currentState.fachgebiete.length > 0 ? currentState.fachgebiete.join(', ') : 'keine'}
- Zielgruppen: ${currentState.zielgruppen.length > 0 ? currentState.zielgruppen.join(', ') : 'keine'}
- Freigegeben: ${currentState.freigegeben ? 'ja' : 'nein'}
- Zusammenfassung bestätigt: ${currentState.zusammenfassungBestaetigt ? 'ja' : 'nein'}

KONVERSATIONSVERLAUF:
${conversation}`;

    const message: OpenAIMessage = {
      role: 'user',
      content: this.getParserPrompt(stateInfo)
    };

    return this.openaiService.sendMessage([message]).pipe(
      map((response: OpenAIResponse) => {
        try {
          console.log('Parser response:', response.choices[0].message.content);
          const parsed = JSON.parse(response.choices[0].message.content);
          return this.validateParsedState(parsed);
        } catch (e) {
          console.error('Failed to parse state:', e);
          return null;
        }
      })
    );
  }

  private getParserPrompt(conversation: string): string {
    return `Analysiere die folgende Konversation und extrahiere die relevanten Werte in einem JSON-Format.
Berücksichtige nur definitive Aussagen und ignoriere unklare oder widersprüchliche Angaben.
Beachte besonders den aktuellen Formularstand und extrahiere nur Änderungen, die sich aus der letzten Konversation ergeben.

VERFÜGBARE WERTE:
Bildungsstufen: ${this.bildungsstufen.join(', ')}
Fachgebiete: ${this.fachgebiete.join(', ')}
Zielgruppen: ${this.zielgruppen.join(', ')}

${conversation}

ERWARTETES FORMAT:
{
  "themenbaumthema": string | null,    // Extrahiertes Thema oder null
  "hauptkategorien": number | null,     // Zahl zwischen 1-30 oder null
  "unterkategorien": number | null,     // Zahl zwischen 0-20 oder null
  "weitereUnterkategorien": number | null, // Zahl zwischen 0-20 oder null
  "bildungsstufen": string[],          // Nur Werte aus der Liste oben
  "fachgebiete": string[],             // Nur Werte aus der Liste oben
  "zielgruppen": string[],             // Nur Werte aus der Liste oben
  "freigegeben": boolean,              // true wenn explizit freigegeben, sonst false
  "zusammenfassungBestaetigt": boolean // true wenn explizit bestätigt, sonst false
}

REGELN:
1. Extrahiere nur klar kommunizierte Werte
2. Bei Unsicherheit verwende null für Einzelwerte oder leere Arrays für Listen
3. Validiere Zahlenbereiche:
   - hauptkategorien: 1-30
   - unterkategorien: 0-20
   - weitereUnterkategorien: 0-20
4. Verwende nur die verfügbaren Werte für Arrays
5. Setze freigegeben auf true wenn:
   - Der Benutzer explizit zustimmt/bestätigt
   - Positive Antworten wie "ja", "einverstanden", "passt so", etc.
6. Setze zusammenfassungBestaetigt auf true wenn:
   - Der Benutzer explizit die Zusammenfassung bestätigt
   - Positive Antworten auf eine präsentierte Zusammenfassung
7. Ignoriere widersprüchliche Angaben
8. Berücksichtige den aktuellen Formularstand und extrahiere nur neue oder geänderte Werte

Antworte NUR mit dem JSON-Objekt, ohne zusätzlichen Text.`;
  }

  private determineNextStep(state: FormState): string {
    if (!state.themenbaumthema) {
      return "Erfrage das Thema des Themenbaums.";
    }
    if (state.themenbaumthema && state.hauptkategorien === null) {
      return "Erfrage die Anzahl der Hauptkategorien (1-30, empfohlen: 10-12).";
    }
    if (state.hauptkategorien !== null && state.unterkategorien === null) {
      return "Erfrage die Anzahl der Unterkategorien (0-20).";
    }
    if (state.unterkategorien !== null && state.weitereUnterkategorien === null) {
      return "Erfrage die Anzahl der weiteren Unterkategorien (0-20).";
    }
    if (state.weitereUnterkategorien !== null && 
        (state.bildungsstufen.length === 0 || 
         state.fachgebiete.length === 0 || 
         state.zielgruppen.length === 0)) {
      return "Biete an, optionale Metadaten (Bildungsstufen, Fachgebiete, Zielgruppen) festzulegen.";
    }
    if (!state.freigegeben) {
      return "Präsentiere eine Zusammenfassung aller Eingaben und bitte um Freigabe.";
    }
    return "Konfiguration ist abgeschlossen und freigegeben.";
  }

  private validateParsedState(parsed: any): FormState | null {
    if (!parsed || typeof parsed !== 'object') return null;

    const currentState = this.formGroup.value;

    try {
      const state: FormState = {
        themenbaumthema: this.validateString(parsed.themenbaumthema) ?? currentState.themenbaumthema,
        hauptkategorien: this.validateNumber(parsed.hauptkategorien, 1, 30) ?? currentState.hauptkategorien,
        unterkategorien: this.validateNumber(parsed.unterkategorien, 0, 20) ?? currentState.unterkategorien,
        weitereUnterkategorien: this.validateNumber(parsed.weitereUnterkategorien, 0, 20) ?? currentState.weitereUnterkategorien,
        bildungsstufen: this.validateArray(parsed.bildungsstufen, this.bildungsstufen) || currentState.bildungsstufen,
        fachgebiete: this.validateArray(parsed.fachgebiete, this.fachgebiete) || currentState.fachgebiete,
        zielgruppen: this.validateArray(parsed.zielgruppen, this.zielgruppen) || currentState.zielgruppen,
        freigegeben: parsed.freigegeben ?? currentState.freigegeben,
        zusammenfassungBestaetigt: this.extractZusammenfassungBestaetigung(parsed) ?? currentState.zusammenfassungBestaetigt
      };

      return state;
    } catch (e) {
      console.error('Validation error:', e);
      return null;
    }
  }

  private extractZusammenfassungBestaetigung(parsed: any): boolean {
    // Prüfe auf explizite Bestätigung der Zusammenfassung
    if (typeof parsed.zusammenfassungBestaetigt === 'boolean') {
      return parsed.zusammenfassungBestaetigt;
    }

    // Prüfe den Text auf Bestätigungsphrasen
    const content = parsed.content || '';
    const confirmationPattern = /\b(bestätige|akzeptiere|stimme zu|ja zur zusammenfassung)\b/i;
    return confirmationPattern.test(content);
  }

  private validateString(value: any): string | null {
    if (typeof value === 'string') {
      const cleaned = value.trim();
      return cleaned || null;
    }
    return null;
  }

  private validateNumber(value: any, min: number, max: number): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    if (!isNaN(num) && num >= min && num <= max) {
      return num;
    }
    return null;
  }

  private validateArray(value: any, allowedValues: string[]): string[] | null {
    if (!Array.isArray(value)) return null;
    const validValues = value
      .filter((v): v is string => typeof v === 'string')
      .map(v => v.trim())
      .filter(v => v && allowedValues.includes(v));
    return validValues.length > 0 ? validValues : null;
  }

  private updateFormState(state: FormState) {
    // Only update fields that have valid values
    const update: Partial<FormState> = {};

    if (state.themenbaumthema !== null) {
      update.themenbaumthema = state.themenbaumthema;
    }
    if (state.hauptkategorien !== null) {
      update.hauptkategorien = state.hauptkategorien;
    }
    if (state.unterkategorien !== null) {
      update.unterkategorien = state.unterkategorien;
    }
    if (state.weitereUnterkategorien !== null) {
      update.weitereUnterkategorien = state.weitereUnterkategorien;
    }
    if (state.bildungsstufen.length > 0) {
      update.bildungsstufen = state.bildungsstufen;
    }
    if (state.fachgebiete.length > 0) {
      update.fachgebiete = state.fachgebiete;
    }
    if (state.zielgruppen.length > 0) {
      update.zielgruppen = state.zielgruppen;
    }
    if (state.freigegeben !== null) {
      update.freigegeben = state.freigegeben;
      
      // Wenn die Freigabe erteilt wurde, zeige sofort den API-Aufruf an
      if (update.freigegeben && state.zusammenfassungBestaetigt) {
        const apiRequest = {
          thema: this.formGroup.value.themenbaumthema,
          hauptkategorien: this.formGroup.value.hauptkategorien,
          unterkategorien: this.formGroup.value.unterkategorien,
          weitereUnterkategorien: this.formGroup.value.weitereUnterkategorien,
          bildungsstufen: this.formGroup.value.bildungsstufen,
          fachgebiete: this.formGroup.value.fachgebiete,
          zielgruppen: this.formGroup.value.zielgruppen
        };
        
        const curlCommand = this.themenbaumService.generateCurlCommand(apiRequest);
        this.addBotMessage(`
# Themenbaum wird generiert

Der folgende API-Aufruf wird zur Generierung des Themenbaums verwendet:

\`\`\`bash
${curlCommand}
\`\`\`

Die Generierung des Themenbaums wird in Kürze gestartet.`);
      }
    }
    if (state.zusammenfassungBestaetigt !== null) {
      update.zusammenfassungBestaetigt = state.zusammenfassungBestaetigt;
    }

    // Only patch if we have updates
    if (Object.keys(update).length > 0) {
      this.formGroup.patchValue(update);
    }
  }

  private addUserMessage(content: string) {
    this.messages.push({ sender: 'user', content });
  }

  private addBotMessage(content: string) {
    this.messages.push({ sender: 'bot', content });
  }

  formatMessage(content: string): SafeHtml {
    // Einfache Markdown-Formatierung
    let html = content
      // Code-Blöcke
      .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
      // Inline-Code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Überschriften
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // Listen
      .replace(/^\* (.*$)/gm, '<li>$1</li>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/^(\d+\.) (.*$)/gm, '<li>$2</li>')
      // Fett und Kursiv
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Zeilenumbrüche
      .replace(/\n/g, '<br>');

    // Listen-Container hinzufügen
    if (html.includes('<li>')) {
      html = '<ul>' + html + '</ul>';
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  onSelectChange(field: string, event: any) {
    const value = event.target.value;
    if (!value) return;

    const currentValues = this.formGroup.get(field)?.value || [];
    if (!currentValues.includes(value)) {
      this.formGroup.patchValue({
        [field]: [...currentValues, value]
      });
    }

    // Reset select after value is added
    event.target.value = '';
  }

  removeValue(field: string, value: string) {
    const currentValues = this.formGroup.get(field)?.value || [];
    const newValues = currentValues.filter((v: string) => v !== value);
    this.formGroup.patchValue({ [field]: newValues });
  }

  sendMessage() {
    if (this.userInput.trim()) {
      this.addUserMessage(this.userInput);
      this.processUserInput(this.userInput);
      this.userInput = '';
    }
  }

  getStatusClass(): string {
    const state = this.formGroup.value;
    
    if (state.zusammenfassungBestaetigt && state.freigegeben) {
      return 'status-green';
    }
    
    if (state.themenbaumthema && 
        state.hauptkategorien !== null && 
        state.unterkategorien !== null && 
        state.weitereUnterkategorien !== null) {
      return 'status-yellow';
    }
    
    return 'status-red';
  }

  getStatusText(): string {
    const state = this.formGroup.value;
    
    if (state.zusammenfassungBestaetigt && state.freigegeben) {
      return 'Konfiguration freigegeben';
    }
    
    if (state.themenbaumthema && 
        state.hauptkategorien !== null && 
        state.unterkategorien !== null && 
        state.weitereUnterkategorien !== null) {
      return 'Mindestangaben erfüllt';
    }
    
    return 'Mindestangaben erforderlich';
  }
}
