# KI-Assistent für Themenbaum-Konfiguration

## Übersicht
Boerdie ist ein interaktiver KI-Assistent, der Benutzer durch den Prozess der Konfiguration eines strukturierten Themenbaums für Bildungsinhalte führt. Der Assistent ist als Angular-Komponente implementiert und nutzt die OpenAI API für die Verarbeitung natürlicher Sprache.

## Funktionen
- 🎯 **Schrittweise Konfiguration** eines Themenbaums mit 3 Hierarchieebenen
- 🎨 **Dynamischer Status-Indikator** (rot/gelb/grün) für den Fortschritt
- 📝 **Markdown-Unterstützung** für formatierte Chat-Nachrichten
- 🔄 **Sofortige Formular-Updates** nach Bot-Antworten
- 🎓 **Bildungsstufen-Integration** mit standardisierten URIs
- 📚 **Fachgebiete-Mapping** zu offiziellen Taxonomien
- 👥 **Zielgruppen-Verwaltung** mit definierten Rollen

## Installation

```bash
# Repository klonen
git clone [repository-url]
cd chat-angular

# Abhängigkeiten installieren
npm install
```

## Konfiguration

### 1. Umgebungsvariablen
Erstellen Sie eine `environment.ts` und `environment.prod.ts` im Verzeichnis `src/environments/`:

```typescript
export const environment = {
  production: false, // true für environment.prod.ts
  openai: {
    apiKey: 'YOUR_OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4-1106-preview' // oder anderes unterstütztes Modell
  }
};
```

### 2. OpenAI API-Schlüssel
1. Besuchen Sie [OpenAI API](https://platform.openai.com/)
2. Erstellen Sie einen API-Schlüssel
3. Fügen Sie den Schlüssel in Ihre Umgebungsvariablen ein

### 3. Unterstützte OpenAI Modelle
- Empfohlen: `gpt-4-1106-preview`
- Alternativ: `gpt-4`, `gpt-3.5-turbo`

## Entwicklung und Test

### Lokaler Entwicklungsserver
```bash
ng serve
```
Navigieren Sie zu `http://localhost:4200/`

### Tests ausführen
```bash
# Unit Tests
ng test

# End-to-End Tests
ng e2e
```

## Integration als Web-Komponente

### 1. Komponente registrieren
```typescript
import { createCustomElement } from '@angular/elements';
import { ChatAssistantComponent } from './components/chat-assistant/chat-assistant.component';

@NgModule({
  // ...
})
export class AppModule {
  constructor(private injector: Injector) {
    const chatElement = createCustomElement(ChatAssistantComponent, { injector });
    customElements.define('boerdie-chat', chatElement);
  }
}
```

### 2. In HTML einbinden
```html
<boerdie-chat></boerdie-chat>
```

### 3. Build als Web-Komponente
```bash
ng build --output-hashing=none --single-bundle true
```

## API-Integration

### Simulierter API-Aufruf
Nach Abschluss der Konfiguration generiert der Assistent einen API-Aufruf im folgenden Format:

```bash
curl -X POST https://api.beispiel.de/themenbaumgenerierung \
     -H "Content-Type: application/json" \
     -d '{
  "thema": "Beispielthema",
  "hauptkategorien": 5,
  "unterkategorien": 3,
  "weitereUnterkategorien": 2,
  "ccm:educationalcontext": [
    "http://w3id.org/openeduhub/vocabs/educationalContext/sekundarstufe_1"
  ],
  "ccm:taxonid": [
    "http://w3id.org/openeduhub/vocabs/discipline/380"
  ],
  "ccm:educationalintendedenduserrole": [
    "http://w3id.org/openeduhub/vocabs/lom_intended_end_user_role/teacher"
  ]
}'
```

## Komponenten-Struktur

### Chat-Assistant
- **Hauptkomponente**: `ChatAssistantComponent`
- **Template**: Chatoberfläche mit Nachrichten und Formular
- **Services**: 
  - `OpenAIService`: API-Kommunikation
  - `ThemenbaumService`: Generierung des API-Aufrufs

### Mappings
- **Bildungsstufen**: `EDUCATIONAL_CONTEXT_MAPPING`
- **Fachgebiete**: `DISCIPLINE_MAPPING`
- **Zielgruppen**: `TARGET_GROUP_MAPPING`

## Status-Indikatoren

- 🔴 **Rot**: Mindestangaben erforderlich
- 🟡 **Gelb**: Mindestangaben erfüllt
- 🟢 **Grün**: Konfiguration freigegeben

## Best Practices

### Entwicklung
- Nutzen Sie TypeScript strict mode
- Führen Sie regelmäßige Tests durch
- Halten Sie die Abhängigkeiten aktuell

### Deployment
- Setzen Sie Umgebungsvariablen korrekt
- Sichern Sie den API-Schlüssel
- Aktivieren Sie Produktions-Optimierungen

## Lizenz
[Ihre Lizenz hier]

## Support
[Kontaktinformationen oder Link zum Issue-Tracker]
