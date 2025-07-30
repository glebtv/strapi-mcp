// Helper to create test data in Strapi

import axios from 'axios';

interface TestCredentials {
  strapiUrl: string;
  adminEmail: string;
  adminPassword: string;
  adminJwt?: string;
}

export class TestDataHelper {
  private credentials: TestCredentials;
  private jwt: string | null = null;

  constructor(credentials: TestCredentials) {
    this.credentials = credentials;
    this.jwt = credentials.adminJwt || null;
  }

  async login(): Promise<void> {
    if (this.jwt) return;

    const response = await axios.post(`${this.credentials.strapiUrl}/admin/login`, {
      email: this.credentials.adminEmail,
      password: this.credentials.adminPassword
    });

    this.jwt = response.data.data.token;
  }

  async createTestProject(data: any): Promise<any> {
    await this.login();
    
    const response = await axios.post(
      `${this.credentials.strapiUrl}/api/projects`,
      { data },
      {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  async createTestTag(data: any): Promise<any> {
    await this.login();
    
    const response = await axios.post(
      `${this.credentials.strapiUrl}/api/tags`,
      { data },
      {
        headers: {
          'Authorization': `Bearer ${this.jwt}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  async deleteAllProjects(): Promise<void> {
    await this.login();
    
    // Get all projects
    const response = await axios.get(`${this.credentials.strapiUrl}/api/projects`, {
      headers: { 'Authorization': `Bearer ${this.jwt}` }
    });

    // Delete each one
    for (const project of response.data.data || []) {
      await axios.delete(`${this.credentials.strapiUrl}/api/projects/${project.documentId}`, {
        headers: { 'Authorization': `Bearer ${this.jwt}` }
      });
    }
  }

  async deleteAllTags(): Promise<void> {
    await this.login();
    
    // Get all tags
    const response = await axios.get(`${this.credentials.strapiUrl}/api/tags`, {
      headers: { 'Authorization': `Bearer ${this.jwt}` }
    });

    // Delete each one
    for (const tag of response.data.data || []) {
      await axios.delete(`${this.credentials.strapiUrl}/api/tags/${tag.documentId}`, {
        headers: { 'Authorization': `Bearer ${this.jwt}` }
      });
    }
  }
}