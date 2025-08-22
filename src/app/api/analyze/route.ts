import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json();

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert conversation analyst. Analyze the provided transcript and extract:

1. Main Points: Key topics, important information, and significant insights discussed
2. Action Items: Specific tasks, to-dos, responsibilities, and commitments mentioned
3. Next Steps: Follow-up actions, future plans, and scheduled activities

Instructions:
- Provide 3-5 items for each category when possible
- Be concise but specific
- If a category has no relevant content, provide meaningful "No [category] identified" message
- Focus on actionable and concrete items
- Use clear, professional language
- Return the response in valid JSON format with arrays for each category

Example format:
{
  "mainPoints": ["Point 1", "Point 2", "Point 3"],
  "actionItems": ["Action 1", "Action 2", "Action 3"],
  "nextSteps": ["Step 1", "Step 2", "Step 3"]
}`
        },
        {
          role: "user",
          content: `Please analyze this conversation transcript:\n\n${transcript}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response from GPT-4o
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      // Fallback: Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate the response structure
    const validatedAnalysis = {
      mainPoints: Array.isArray(analysis.mainPoints) ? analysis.mainPoints : ['No main points identified'],
      actionItems: Array.isArray(analysis.actionItems) ? analysis.actionItems : ['No action items identified'],
      nextSteps: Array.isArray(analysis.nextSteps) ? analysis.nextSteps : ['No next steps identified']
    };

    return NextResponse.json({
      success: true,
      analysis: validatedAnalysis,
      usage: completion.usage
    });

  } catch (error) {
    console.error('Error analyzing transcript:', error);
    
    // Return more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Invalid OpenAI API key' },
          { status: 401 }
        );
      }
      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'OpenAI API quota exceeded' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to analyze transcript', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}