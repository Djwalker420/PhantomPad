package com.phantompad.controller;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ConnectActivity extends AppCompatActivity {

    private EditText ipInput, portInput;
    private Button connectBtn;
    private TextView statusText;
    private LinearLayout recentList;
    private SharedPreferences prefs;
    private ExecutorService executor;

    private static final String PREFS_NAME = "PhantomPadPrefs";
    private static final String KEY_RECENT = "recent_servers";
    private static final int MAX_RECENT = 5;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_connect);

        // Keep screen on
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        executor = Executors.newSingleThreadExecutor();

        ipInput = findViewById(R.id.ip_input);
        portInput = findViewById(R.id.port_input);
        connectBtn = findViewById(R.id.connect_btn);
        statusText = findViewById(R.id.status_text);
        recentList = findViewById(R.id.recent_list);

        connectBtn.setOnClickListener(v -> attemptConnect());

        // Auto-fill last used server
        loadRecentServers();

        // Check if we have a saved server and can auto-connect
        String lastIp = prefs.getString("last_ip", "");
        String lastPort = prefs.getString("last_port", "3000");
        if (!lastIp.isEmpty()) {
            ipInput.setText(lastIp);
            portInput.setText(lastPort);
        }
    }

    private void attemptConnect() {
        String ip = ipInput.getText().toString().trim();
        String port = portInput.getText().toString().trim();

        if (ip.isEmpty()) {
            statusText.setText("Please enter a server IP address");
            statusText.setTextColor(getColor(R.color.danger));
            return;
        }

        if (port.isEmpty()) port = "3000";

        connectBtn.setEnabled(false);
        statusText.setText("⏳ Connecting...");
        statusText.setTextColor(getColor(R.color.primary));

        String serverUrl = "http://" + ip + ":" + port;
        String finalPort = port;

        executor.execute(() -> {
            try {
                URL url = new URL(serverUrl + "/api/info");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.setRequestMethod("GET");

                int responseCode = conn.getResponseCode();
                if (responseCode == 200) {
                    // Read response to verify it's PhantomPad
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    reader.close();

                    // Success - save and launch controller
                    runOnUiThread(() -> {
                        statusText.setText("✅ Connected! Loading controller...");
                        statusText.setTextColor(getColor(R.color.success));

                        // Save this server
                        saveServer(ip, finalPort);
                        prefs.edit()
                            .putString("last_ip", ip)
                            .putString("last_port", finalPort)
                            .apply();

                        // Launch controller activity
                        Intent intent = new Intent(ConnectActivity.this, MainActivity.class);
                        intent.putExtra("server_url", serverUrl + "/controller");
                        startActivity(intent);
                        finish();
                    });
                } else {
                    throw new Exception("Server returned " + responseCode);
                }

                conn.disconnect();
            } catch (Exception e) {
                runOnUiThread(() -> {
                    String errorMsg;
                    if (e.getMessage() != null && e.getMessage().contains("timeout")) {
                        errorMsg = "⏱️ Connection timed out. Check IP and server.";
                    } else {
                        errorMsg = "❌ Can't reach " + serverUrl;
                    }
                    statusText.setText(errorMsg);
                    statusText.setTextColor(getColor(R.color.danger));
                    connectBtn.setEnabled(true);
                });
            }
        });
    }

    private void saveServer(String ip, String port) {
        try {
            JSONArray servers = getRecentServers();
            JSONArray newServers = new JSONArray();

            // Add current server first
            JSONObject current = new JSONObject();
            current.put("ip", ip);
            current.put("port", port);
            current.put("time", System.currentTimeMillis());
            newServers.put(current);

            // Add other servers (skip duplicate)
            for (int i = 0; i < servers.length() && newServers.length() < MAX_RECENT; i++) {
                JSONObject s = servers.getJSONObject(i);
                if (!(s.getString("ip").equals(ip) && s.getString("port").equals(port))) {
                    newServers.put(s);
                }
            }

            prefs.edit().putString(KEY_RECENT, newServers.toString()).apply();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private JSONArray getRecentServers() {
        try {
            String json = prefs.getString(KEY_RECENT, "[]");
            return new JSONArray(json);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private void loadRecentServers() {
        try {
            JSONArray servers = getRecentServers();
            recentList.removeAllViews();

            if (servers.length() == 0) {
                findViewById(R.id.recent_section).setVisibility(View.GONE);
                return;
            }

            findViewById(R.id.recent_section).setVisibility(View.VISIBLE);

            for (int i = 0; i < servers.length(); i++) {
                JSONObject server = servers.getJSONObject(i);
                String ip = server.getString("ip");
                String port = server.getString("port");
                long time = server.optLong("time", 0);

                View itemView = getLayoutInflater().inflate(R.layout.item_recent_server, recentList, false);

                TextView ipText = itemView.findViewById(R.id.recent_ip);
                TextView timeText = itemView.findViewById(R.id.recent_time);

                ipText.setText(ip + ":" + port);
                timeText.setText(getTimeAgo(time));

                itemView.setOnClickListener(v -> {
                    ipInput.setText(ip);
                    portInput.setText(port);
                    attemptConnect();
                });

                recentList.addView(itemView);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private String getTimeAgo(long timestamp) {
        if (timestamp == 0) return "";
        long diff = System.currentTimeMillis() - timestamp;
        if (diff < 60000) return "Just now";
        if (diff < 3600000) return (diff / 60000) + "m ago";
        if (diff < 86400000) return (diff / 3600000) + "h ago";
        return (diff / 86400000) + "d ago";
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (executor != null) executor.shutdown();
    }
}
